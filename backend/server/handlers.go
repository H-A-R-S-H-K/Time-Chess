package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// CreateGameRequest is the request body for creating a game.
type CreateGameRequest struct {
	TimeSeconds int64 `json:"timeSeconds"` // Time per player in seconds (default 60)
}

// RegisterHandlers registers all REST API handlers.
func RegisterHandlers(mux *http.ServeMux, gm *GameManager) {
	mux.HandleFunc("/api/game/create", corsMiddleware(handleCreateGame(gm)))
	mux.HandleFunc("/api/game/join", corsMiddleware(handleJoinGame(gm)))
	mux.HandleFunc("/api/matchmake", corsMiddleware(handleMatchmake(gm)))
	mux.HandleFunc("/api/game/status/", corsMiddleware(handleGameStatus(gm)))
	mux.HandleFunc("/api/game/", corsMiddleware(handleGetGame(gm)))
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func handleCreateGame(gm *GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req CreateGameRequest
		if r.Body != nil {
			_ = json.NewDecoder(r.Body).Decode(&req)
		}

		timeMs := int64(60000) // default 60 seconds
		if req.TimeSeconds > 0 {
			timeMs = req.TimeSeconds * 1000
		}

		session := gm.CreateGame(timeMs)
		session.WhiteJoined = true // creator is white

		resp := CreateGameResponse{
			GameID: session.ID,
			Color:  "white",
		}

		log.Printf("Game created: %s (time: %dms)", session.ID, timeMs)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func handleJoinGame(gm *GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			GameID string `json:"gameId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		color, err := gm.JoinGame(req.GameID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		colorStr := "spectator"
		if color == ColorWhite {
			colorStr = "white"
		} else if color == ColorBlack {
			colorStr = "black"
		}

		resp := JoinGameResponse{
			GameID: req.GameID,
			Color:  colorStr,
		}

		log.Printf("Player joined game %s as %s", req.GameID, colorStr)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func handleGetGame(gm *GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Extract game ID from URL: /api/game/{id}
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 4 {
			http.Error(w, "missing game ID", http.StatusBadRequest)
			return
		}
		gameID := parts[len(parts)-1]

		session, ok := gm.GetGame(gameID)
		if !ok {
			http.Error(w, fmt.Sprintf("game not found: %s", gameID), http.StatusNotFound)
			return
		}

		session.mu.RLock()
		resp := BuildGameStateResponse(session.GameState, -1, -1)
		session.mu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func handleMatchmake(gm *GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req CreateGameRequest
		if r.Body != nil {
			_ = json.NewDecoder(r.Body).Decode(&req)
		}

		timeMs := int64(60000)
		if req.TimeSeconds > 0 {
			timeMs = req.TimeSeconds * 1000
		}

		session, color, status := gm.Matchmake(timeMs)

		resp := MatchmakeResponse{
			GameID: session.ID,
			Color:  color,
			Status: status,
		}

		log.Printf("Matchmake: game=%s color=%s status=%s", session.ID, color, status)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func handleGameStatus(gm *GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 5 {
			http.Error(w, "missing game ID", http.StatusBadRequest)
			return
		}
		gameID := parts[len(parts)-1]

		session, ok := gm.GetGame(gameID)
		if !ok {
			http.Error(w, "game not found", http.StatusNotFound)
			return
		}

		session.mu.RLock()
		ready := session.WhiteJoined && session.BlackJoined
		session.mu.RUnlock()

		resp := struct {
			GameID string `json:"gameId"`
			Ready  bool   `json:"ready"`
		}{
			GameID: gameID,
			Ready:  ready,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
