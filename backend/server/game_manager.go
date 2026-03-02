package server

import (
	"chess-backend/game"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// PlayerColor represents which color a player is assigned.
type PlayerColor int

const (
	ColorWhite PlayerColor = iota
	ColorBlack
	ColorSpectator
)

// PlayerConn represents a connected player's WebSocket connection.
type PlayerConn struct {
	Conn  *websocket.Conn
	Color PlayerColor
	mu    sync.Mutex
}

// SendJSON sends a JSON message to the player, thread-safe.
func (pc *PlayerConn) SendJSON(v interface{}) error {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	return pc.Conn.WriteJSON(v)
}

// GameSession holds all state for an active game.
type GameSession struct {
	ID             string
	GameState      *game.GameState
	Players        []*PlayerConn // index 0 = white, index 1 = black
	Spectators     []*PlayerConn
	CreatedAt      time.Time
	LastMoveAt     time.Time
	WhiteJoined    bool
	BlackJoined    bool
	TimerTicker    *time.Ticker
	TimerDone      chan struct{}
	mu             sync.RWMutex
}

// GameManager manages all active game sessions.
type GameManager struct {
	games    map[string]*GameSession
	waitQueue []*GameSession // matchmaking queue
	mu       sync.RWMutex
}

// NewGameManager creates a new game manager.
func NewGameManager() *GameManager {
	return &GameManager{
		games:    make(map[string]*GameSession),
		waitQueue: make([]*GameSession, 0),
	}
}

// generateID creates a short unique game ID.
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano()%1000000000)
}

// CreateGameResponse is the REST response for game creation.
type CreateGameResponse struct {
	GameID string `json:"gameId"`
	Color  string `json:"color"`
}

// JoinGameResponse is the REST response for joining a game.
type JoinGameResponse struct {
	GameID string `json:"gameId"`
	Color  string `json:"color"`
}

// GameStateResponse is the JSON game state sent to clients.
type GameStateResponse struct {
	Type           string          `json:"type"`
	Board          [64]SquareInfo  `json:"board"`
	SideToMove     string          `json:"sideToMove"`
	WhiteTime      int64           `json:"whiteTime"`
	BlackTime      int64           `json:"blackTime"`
	LegalMoves     []LegalMoveInfo `json:"legalMoves"`
	IsCheck        bool            `json:"isCheck"`
	IsCheckmate    bool            `json:"isCheckmate"`
	IsStalemate    bool            `json:"isStalemate"`
	IsGameOver     bool            `json:"isGameOver"`
	GameResult     string          `json:"gameResult"`
	GameOverReason string          `json:"gameOverReason"`
	LastMoveFrom   int             `json:"lastMoveFrom"`
	LastMoveTo     int             `json:"lastMoveTo"`
}

// SquareInfo represents a piece on a square.
type SquareInfo struct {
	Piece string `json:"piece"` // "P","N","B","R","Q","K" or ""
	Color string `json:"color"` // "white","black" or ""
}

// LegalMoveInfo is a simplified move for the frontend.
type LegalMoveInfo struct {
	From      int `json:"from"`
	To        int `json:"to"`
	Promotion int `json:"promotion"`
}

// MatchmakeResponse is the REST response for matchmaking.
type MatchmakeResponse struct {
	GameID string `json:"gameId"`
	Color  string `json:"color"`
	Status string `json:"status"` // "waiting" or "matched"
}

// TimerUpdateResponse is sent periodically with timer info.
type TimerUpdateResponse struct {
	Type      string `json:"type"`
	WhiteTime int64  `json:"whiteTime"`
	BlackTime int64  `json:"blackTime"`
	IsCheck   bool   `json:"isCheck"`
}

// GameOverResponse signals game end.
type GameOverResponse struct {
	Type   string `json:"type"`
	Result string `json:"result"`
	Reason string `json:"reason"`
}

// ErrorResponse signals an error.
type ErrorResponse struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// ClientMessage is the message format from client to server.
type ClientMessage struct {
	Type      string `json:"type"`
	From      int    `json:"from"`
	To        int    `json:"to"`
	Promotion int    `json:"promotion"`
}

// CreateGame creates a new game session.
func (gm *GameManager) CreateGame(timeMs int64) *GameSession {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	id := generateID()
	for {
		if _, exists := gm.games[id]; !exists {
			break
		}
		id = generateID()
	}

	var gs *game.GameState
	if timeMs > 0 {
		gs = game.InitializeGameWithTime(timeMs)
	} else {
		gs = game.InitializeGame()
	}

	session := &GameSession{
		ID:        id,
		GameState: gs,
		Players:   make([]*PlayerConn, 2),
		CreatedAt: time.Now(),
		TimerDone: make(chan struct{}),
	}

	gm.games[id] = session
	return session
}

// GetGame returns a game session by ID.
func (gm *GameManager) GetGame(id string) (*GameSession, bool) {
	gm.mu.RLock()
	defer gm.mu.RUnlock()
	session, ok := gm.games[id]
	return session, ok
}

// JoinGame adds a player to a game session.
func (gm *GameManager) JoinGame(id string) (PlayerColor, error) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	session, ok := gm.games[id]
	if !ok {
		return ColorSpectator, fmt.Errorf("game not found: %s", id)
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if !session.BlackJoined {
		session.BlackJoined = true
		return ColorBlack, nil
	}
	if !session.WhiteJoined {
		session.WhiteJoined = true
		return ColorWhite, nil
	}
	return ColorSpectator, nil
}

// Matchmake finds an opponent or creates a waiting game.
func (gm *GameManager) Matchmake(timeMs int64) (*GameSession, string, string) {
	gm.mu.Lock()
	defer gm.mu.Unlock()

	// Look for a waiting game with same time control
	for i, session := range gm.waitQueue {
		session.mu.Lock()
		if !session.BlackJoined && session.GameState.Position.WhiteKingTime == timeMs {
			session.BlackJoined = true
			session.mu.Unlock()
			// Remove from queue
			gm.waitQueue = append(gm.waitQueue[:i], gm.waitQueue[i+1:]...)
			return session, "black", "matched"
		}
		session.mu.Unlock()
	}

	// No match found — create a new game and wait
	id := generateID()
	for {
		if _, exists := gm.games[id]; !exists {
			break
		}
		id = generateID()
	}

	var gs *game.GameState
	if timeMs > 0 {
		gs = game.InitializeGameWithTime(timeMs)
	} else {
		gs = game.InitializeGame()
	}

	session := &GameSession{
		ID:          id,
		GameState:   gs,
		Players:     make([]*PlayerConn, 2),
		CreatedAt:   time.Now(),
		TimerDone:   make(chan struct{}),
		WhiteJoined: true,
	}

	gm.games[id] = session
	gm.waitQueue = append(gm.waitQueue, session)
	return session, "white", "waiting"
}

// BuildGameStateResponse converts internal state to JSON-friendly format.
func BuildGameStateResponse(gs *game.GameState, lastFrom, lastTo int) GameStateResponse {
	var board [64]SquareInfo

	pieceNames := [6]string{"P", "N", "B", "R", "Q", "K"}

	for sq := 0; sq < 64; sq++ {
		side, pt := gs.Position.PieceOnSquare(sq)
		if pt != game.NoPiece {
			board[sq] = SquareInfo{
				Piece: pieceNames[pt],
				Color: sideToStr(side),
			}
		}
	}

	sideStr := "white"
	if gs.Position.SideToMove == game.Black {
		sideStr = "black"
	}

	legalMoves := make([]LegalMoveInfo, len(gs.LegalMoves))
	for i, m := range gs.LegalMoves {
		legalMoves[i] = LegalMoveInfo{
			From:      m.From(),
			To:        m.To(),
			Promotion: m.Promotion(),
		}
	}

	return GameStateResponse{
		Type:           "GAME_STATE_UPDATE",
		Board:          board,
		SideToMove:     sideStr,
		WhiteTime:      gs.Position.WhiteKingTime,
		BlackTime:      gs.Position.BlackKingTime,
		LegalMoves:     legalMoves,
		IsCheck:        gs.IsCheck,
		IsCheckmate:    gs.IsCheckmate,
		IsStalemate:    gs.IsStalemate,
		IsGameOver:     gs.IsGameOver,
		GameResult:     string(gs.GameResult),
		GameOverReason: gs.GameOverReason,
		LastMoveFrom:   lastFrom,
		LastMoveTo:     lastTo,
	}
}

func sideToStr(side int) string {
	if side == game.White {
		return "white"
	}
	return "black"
}

// HandleMove processes a move from a player.
func (session *GameSession) HandleMove(from, to, promotion int, playerColor PlayerColor) (*GameStateResponse, error) {
	session.mu.Lock()
	defer session.mu.Unlock()

	if session.GameState.IsGameOver {
		return nil, fmt.Errorf("game is already over")
	}

	// Verify it's the player's turn
	expectedColor := ColorWhite
	if session.GameState.Position.SideToMove == game.Black {
		expectedColor = ColorBlack
	}
	if playerColor != expectedColor {
		return nil, fmt.Errorf("not your turn")
	}

	// Calculate time spent
	var timeSpentMs int64
	now := time.Now()
	if !session.LastMoveAt.IsZero() {
		timeSpentMs = now.Sub(session.LastMoveAt).Milliseconds()
	}
	session.LastMoveAt = now

	// Apply the move
	move := game.NewMove(from, to, 0, promotion, 0)
	newGS, err := game.ValidateAndApplyMove(session.GameState, move, timeSpentMs)
	if err != nil {
		return nil, err
	}

	session.GameState = newGS

	resp := BuildGameStateResponse(newGS, from, to)
	return &resp, nil
}

// BroadcastToAll sends a message to all connected players and spectators.
func (session *GameSession) BroadcastToAll(msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	for _, p := range session.Players {
		if p != nil && p.Conn != nil {
			p.mu.Lock()
			_ = p.Conn.WriteMessage(websocket.TextMessage, data)
			p.mu.Unlock()
		}
	}
	for _, s := range session.Spectators {
		if s != nil && s.Conn != nil {
			s.mu.Lock()
			_ = s.Conn.WriteMessage(websocket.TextMessage, data)
			s.mu.Unlock()
		}
	}
}

// StartTimerTicker starts a goroutine that broadcasts timer updates.
func (session *GameSession) StartTimerTicker() {
	session.TimerTicker = time.NewTicker(100 * time.Millisecond)

	go func() {
		for {
			select {
			case <-session.TimerDone:
				session.TimerTicker.Stop()
				return
			case <-session.TimerTicker.C:
				session.mu.RLock()
				gs := session.GameState
				if gs.IsGameOver {
					session.mu.RUnlock()
					return
				}

				wt := gs.Position.WhiteKingTime
				bt := gs.Position.BlackKingTime
				isCheck := gs.IsCheck

				// Deduct elapsed time from active player
				if !session.LastMoveAt.IsZero() {
					elapsed := time.Since(session.LastMoveAt).Milliseconds()
					if gs.Position.SideToMove == game.White {
						wt -= elapsed
						if wt < 0 {
							wt = 0
						}
					} else {
						bt -= elapsed
						if bt < 0 {
							bt = 0
						}
					}
				}
				session.mu.RUnlock()

				update := TimerUpdateResponse{
					Type:      "TIMER_UPDATE",
					WhiteTime: wt,
					BlackTime: bt,
					IsCheck:   isCheck,
				}
				session.BroadcastToAll(update)

				// Check for timeout
				if wt <= 0 || bt <= 0 {
					session.mu.Lock()
					if !session.GameState.IsGameOver {
						session.GameState.IsGameOver = true
						if wt <= 0 {
							session.GameState.GameResult = game.ResultBlackWins
							session.GameState.GameOverReason = "white king timeout"
						} else {
							session.GameState.GameResult = game.ResultWhiteWins
							session.GameState.GameOverReason = "black king timeout"
						}
						gameOver := GameOverResponse{
							Type:   "GAME_OVER",
							Result: string(session.GameState.GameResult),
							Reason: session.GameState.GameOverReason,
						}
						session.mu.Unlock()
						session.BroadcastToAll(gameOver)
					} else {
						session.mu.Unlock()
					}
					return
				}
			}
		}
	}()
}

// StopTimerTicker stops the timer ticker.
func (session *GameSession) StopTimerTicker() {
	close(session.TimerDone)
}
