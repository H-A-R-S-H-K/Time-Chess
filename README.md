# ♟ Time-Attack Chess

A full-stack chess application with a custom **Time-Attack** game mode — built from scratch with a bitboard-based engine in Go and a real-time React frontend.

In Time-Attack mode, each king has a countdown timer. Spend time thinking and your clock ticks down — but deliver a check and you're rewarded with bonus time while your opponent is penalized. Run out of time and you lose. It adds a whole new strategic dimension to chess.

---

## ✨ Features

- **Custom Chess Engine** — Complete chess logic built from scratch using bitboard representation in Go (no external chess libraries)
- **Time-Attack Mode** — Each player's king has a countdown timer that ticks in real-time
  - **Check Bonus:** +10 seconds for the attacker when delivering check
  - **Check Penalty:** −5 seconds for the defender when in check
  - **Timeout Loss:** If your timer hits zero, you lose
- **Real-Time Multiplayer** — WebSocket-powered live gameplay with instant state sync
- **Matchmaking** — Quick-play matchmaking queue to find opponents instantly
- **Full Rule Support** — Castling, en passant, promotion, 50-move rule, stalemate, and checkmate detection
- **Sound Effects** — Audio feedback for moves, captures, checks, and game-over events
- **Dark Theme UI** — Polished, modern interface with smooth animations and move highlights

---

## 🏗 Architecture

```
Chess/
├── *.go                  # Core chess engine (bitboard, moves, attacks, timers)
├── chess_test.go         # Comprehensive engine test suite
├── backend/
│   ├── main.go           # HTTP server entrypoint
│   ├── game/             # Engine packaged for the backend
│   └── server/
│       ├── handlers.go   # REST API endpoints
│       ├── websocket.go  # WebSocket handler for live games
│       └── game_manager.go  # Session & matchmaking management
└── frontend/
    └── src/
        ├── App.tsx           # Main app with routing
        ├── pages/Game.tsx    # Game page (board + timers + controls)
        ├── components/
        │   ├── ChessBoard.tsx  # Interactive board with drag & drop
        │   ├── Square.tsx      # Individual square rendering
        │   └── Timer.tsx       # Countdown timer display
        └── services/
            ├── api.ts          # REST API client
            └── websocket.ts    # WebSocket client
```

### Chess Engine

The engine uses **bitboard representation** — each piece type for each side is stored as a 64-bit integer where each bit maps to a square on the board. This enables extremely fast move generation and position evaluation using bitwise operations.

Key modules:
| File | Purpose |
|---|---|
| `bitboard.go` | Board representation, bit manipulation utilities |
| `attacks.go` | Pre-computed attack tables for all piece types |
| `move.go` | Move encoding (from/to/flags packed into a single `uint32`) |
| `move_validation.go` | Pseudo-legal & legal move generation, move application |
| `position.go` | Full game state (pieces, castling rights, en passant, clocks) |
| `timer.go` | Time-attack logic — deductions, check bonuses/penalties |
| `game.go` | High-level game API (initialize, validate, apply moves) |

### Backend

A Go HTTP server using the standard library + [gorilla/websocket](https://github.com/gorilla/websocket):

| Endpoint | Method | Description |
|---|---|---|
| `POST /api/game/create` | REST | Create a new game with custom time |
| `POST /api/game/join` | REST | Join an existing game by ID |
| `POST /api/matchmake` | REST | Find or create a game via matchmaking |
| `POST /api/matchmake/cancel` | REST | Cancel matchmaking |
| `GET /api/game/{id}` | REST | Get current game state |
| `GET /api/game/status/{id}` | REST | Check if both players have joined |
| `ws://host:8080/ws/{gameId}` | WebSocket | Real-time game connection |

### Frontend

React 19 + TypeScript + Vite with a component-based architecture. The board renders piece SVGs, highlights legal moves on click, and communicates with the backend over WebSocket for sub-second latency.

---

## 🚀 Getting Started

### Prerequisites

- **Go** 1.23+
- **Node.js** 18+ and **npm**

### Run the Backend

```bash
cd backend
go run main.go
```

The server starts on `http://localhost:8080`.

### Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts on `http://localhost:5173` (default Vite port).

### Run Engine Tests

```bash
go test -v ./...
```

---

## 🎮 How to Play

1. Start both the backend and frontend
2. Open the app in your browser
3. Choose **Quick Play** to enter the matchmaking queue, or **Create Game** for a private match
4. Share the game link with an opponent (or open a second browser tab)
5. Play chess! Watch your king timer — deliver checks to gain time

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Engine | Go, Bitboards |
| Backend | Go `net/http`, gorilla/websocket |
| Frontend | React 19, TypeScript, Vite |
| Communication | REST + WebSocket |
| Styling | Vanilla CSS (dark theme) |

---

## 📄 License

This project is for personal/educational use.
