package main

import (
	"chess-backend/server"
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	gm := server.NewGameManager()

	mux := http.NewServeMux()

	// Register REST endpoints
	server.RegisterHandlers(mux, gm)

	// Register WebSocket endpoint
	server.RegisterWebSocket(mux, gm)

	// Serve static info at root
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"service":"chess-backend","status":"running"}`)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := "0.0.0.0:" + port
	log.Printf("♟  Chess server starting on http://127.0.0.1:%s", port)
	log.Printf("   REST:      POST /api/game/create, POST /api/game/join, GET /api/game/{id}")
	log.Printf("   WebSocket: ws://127.0.0.1:8080/ws/{gameId}?color=white|black")

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
