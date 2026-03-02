const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8080/api';

export interface CreateGameResponse {
  gameId: string;
  color: string;
}

export interface JoinGameResponse {
  gameId: string;
  color: string;
}

export interface MatchmakeResponse {
  gameId: string;
  color: string;
  status: 'waiting' | 'matched';
}

export interface GameStatusResponse {
  gameId: string;
  ready: boolean;
}

export interface SquareInfo {
  piece: string;
  color: string;
}

export interface LegalMoveInfo {
  from: number;
  to: number;
  promotion: number;
}

export interface GameStateResponse {
  type: string;
  board: SquareInfo[];
  sideToMove: string;
  whiteTime: number;
  blackTime: number;
  legalMoves: LegalMoveInfo[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isGameOver: boolean;
  gameResult: string;
  gameOverReason: string;
  lastMoveFrom: number;
  lastMoveTo: number;
}

export async function createGame(timeSeconds: number = 60): Promise<CreateGameResponse> {
  const res = await fetch(`${API_BASE}/game/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeSeconds }),
  });
  if (!res.ok) throw new Error('Failed to create game');
  return res.json();
}

export async function joinGame(gameId: string): Promise<JoinGameResponse> {
  const res = await fetch(`${API_BASE}/game/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  });
  if (!res.ok) throw new Error('Failed to join game');
  return res.json();
}

export async function matchmake(timeSeconds: number = 60): Promise<MatchmakeResponse> {
  const res = await fetch(`${API_BASE}/matchmake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeSeconds }),
  });
  if (!res.ok) throw new Error('Failed to matchmake');
  return res.json();
}

export async function getGameStatus(gameId: string): Promise<GameStatusResponse> {
  const res = await fetch(`${API_BASE}/game/status/${gameId}`);
  if (!res.ok) throw new Error('Failed to get game status');
  return res.json();
}

export async function cancelMatchmake(gameId: string): Promise<void> {
  await fetch(`${API_BASE}/matchmake/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  });
}

export async function getGame(gameId: string): Promise<GameStateResponse> {
  const res = await fetch(`${API_BASE}/game/${gameId}`);
  if (!res.ok) throw new Error('Failed to get game');
  return res.json();
}
