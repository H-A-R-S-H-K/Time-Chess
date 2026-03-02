import type { GameStateResponse } from './api';

const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://127.0.0.1:8080/ws';

export type MessageHandler = (data: GameStateResponse | TimerUpdate | GameOver | ErrorMsg) => void;

export interface TimerUpdate {
    type: 'TIMER_UPDATE';
    whiteTime: number;
    blackTime: number;
    isCheck: boolean;
}

export interface GameOver {
    type: 'GAME_OVER';
    result: string;
    reason: string;
}

export interface ErrorMsg {
    type: 'ERROR';
    message: string;
}

export class ChessWebSocket {
    private ws: WebSocket | null = null;
    private gameId: string;
    private color: string;
    private onMessage: MessageHandler;
    private onOpen: (() => void) | null = null;
    private onClose: (() => void) | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(gameId: string, color: string, onMessage: MessageHandler) {
        this.gameId = gameId;
        this.color = color;
        this.onMessage = onMessage;
    }

    connect() {
        const url = `${WS_BASE}/${this.gameId}?color=${this.color}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.onOpen?.();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.onMessage(data);
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.onClose?.();
            this.reconnectTimer = setTimeout(() => {
                if (this.ws?.readyState === WebSocket.CLOSED) {
                    console.log('Attempting reconnect...');
                    this.connect();
                }
            }, 2000);
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }

    sendMove(from: number, to: number, promotion: number = 0) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'MOVE',
                from,
                to,
                promotion,
            }));
        }
    }

    setOnOpen(fn: () => void) {
        this.onOpen = fn;
    }

    setOnClose(fn: () => void) {
        this.onClose = fn;
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
