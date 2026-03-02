import React, { useEffect, useState, useCallback, useRef } from 'react';
import ChessBoard from '../components/ChessBoard';
import Timer from '../components/Timer';
import type { GameStateResponse, SquareInfo, LegalMoveInfo } from '../services/api';
import { ChessWebSocket } from '../services/websocket';
import type { TimerUpdate, GameOver, ErrorMsg } from '../services/websocket';
import {
    playMoveSound,
    playCaptureSound,
    playCheckSound,
    playCastleSound,
    playGameEndSound,
    playGameStartSound,
} from '../sounds';

interface GameProps {
    gameId: string;
    playerColor: string;
    onLeave: () => void;
}

const INITIAL_BOARD: SquareInfo[] = Array(64).fill({ piece: '', color: '' });

const Game: React.FC<GameProps> = ({ gameId, playerColor, onLeave }) => {
    const [board, setBoard] = useState<SquareInfo[]>(INITIAL_BOARD);
    const [legalMoves, setLegalMoves] = useState<LegalMoveInfo[]>([]);
    const [sideToMove, setSideToMove] = useState('white');
    const [whiteTime, setWhiteTime] = useState(60000);
    const [blackTime, setBlackTime] = useState(60000);
    const [isCheck, setIsCheck] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const [gameResult, setGameResult] = useState('');
    const [gameOverReason, setGameOverReason] = useState('');
    const [lastMoveFrom, setLastMoveFrom] = useState(-1);
    const [lastMoveTo, setLastMoveTo] = useState(-1);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState('');

    // Time delta animations
    const [whiteTimeDelta, setWhiteTimeDelta] = useState<{ value: number; key: number } | null>(null);
    const [blackTimeDelta, setBlackTimeDelta] = useState<{ value: number; key: number } | null>(null);
    const prevWhiteTime = useRef<number>(60000);
    const prevBlackTime = useRef<number>(60000);
    const deltaKeyRef = useRef(0);
    const lastCheckState = useRef(false);
    const prevBoard = useRef<SquareInfo[]>(INITIAL_BOARD);
    const isFirstUpdate = useRef(true);

    const wsRef = useRef<ChessWebSocket | null>(null);

    const handleMessage = useCallback((data: GameStateResponse | TimerUpdate | GameOver | ErrorMsg) => {
        switch (data.type) {
            case 'GAME_STATE_UPDATE': {
                const gs = data as GameStateResponse;
                setBoard(gs.board);
                setLegalMoves(gs.legalMoves || []);
                setSideToMove(gs.sideToMove);
                setWhiteTime(gs.whiteTime);
                setBlackTime(gs.blackTime);
                setIsCheck(gs.isCheck);
                setIsGameOver(gs.isGameOver);
                setGameResult(gs.gameResult);
                setGameOverReason(gs.gameOverReason);
                setLastMoveFrom(gs.lastMoveFrom);
                setLastMoveTo(gs.lastMoveTo);

                // Detect check bonus/penalty from time jumps
                if (gs.isCheck && !lastCheckState.current && !gs.isGameOver) {
                    const wDiff = gs.whiteTime - prevWhiteTime.current;
                    const bDiff = gs.blackTime - prevBlackTime.current;

                    // If white time increased significantly, white gave check
                    if (wDiff > 3000) {
                        deltaKeyRef.current++;
                        setWhiteTimeDelta({ value: 10000, key: deltaKeyRef.current });
                        setTimeout(() => setWhiteTimeDelta(null), 1600);
                    }
                    if (bDiff < -2000) {
                        deltaKeyRef.current++;
                        setBlackTimeDelta({ value: -5000, key: deltaKeyRef.current });
                        setTimeout(() => setBlackTimeDelta(null), 1600);
                    }

                    // If black time increased significantly, black gave check
                    if (bDiff > 3000) {
                        deltaKeyRef.current++;
                        setBlackTimeDelta({ value: 10000, key: deltaKeyRef.current });
                        setTimeout(() => setBlackTimeDelta(null), 1600);
                    }
                    if (wDiff < -2000) {
                        deltaKeyRef.current++;
                        setWhiteTimeDelta({ value: -5000, key: deltaKeyRef.current });
                        setTimeout(() => setWhiteTimeDelta(null), 1600);
                    }
                }

                // Play sound effects
                if (gs.lastMoveFrom >= 0 && gs.lastMoveTo >= 0 && !isFirstUpdate.current) {
                    if (gs.isCheckmate) {
                        // Checkmate - play game end sound
                        playGameEndSound();
                    } else if (gs.isCheck) {
                        // Check sound
                        playCheckSound();
                    } else {
                        // Detect castling: king moved 2+ squares horizontally
                        const fromFile = gs.lastMoveFrom % 8;
                        const toFile = gs.lastMoveTo % 8;
                        const isCastle = Math.abs(fromFile - toFile) >= 2 &&
                            gs.board[gs.lastMoveTo]?.piece === 'K';

                        if (isCastle) {
                            playCastleSound();
                        } else {
                            // Detect capture: was there a piece on target square before?
                            const prevPiece = prevBoard.current[gs.lastMoveTo];
                            const wasCapture = prevPiece?.piece && prevPiece.piece !== '';
                            if (wasCapture) {
                                playCaptureSound();
                            } else {
                                playMoveSound();
                            }
                        }
                    }
                }
                isFirstUpdate.current = false;

                lastCheckState.current = gs.isCheck;
                prevWhiteTime.current = gs.whiteTime;
                prevBlackTime.current = gs.blackTime;
                prevBoard.current = [...gs.board];
                break;
            }
            case 'TIMER_UPDATE': {
                const tu = data as TimerUpdate;
                setWhiteTime(tu.whiteTime);
                setBlackTime(tu.blackTime);
                prevWhiteTime.current = tu.whiteTime;
                prevBlackTime.current = tu.blackTime;
                break;
            }
            case 'GAME_OVER': {
                const go_ = data as GameOver;
                setIsGameOver(true);
                setGameResult(go_.result);
                setGameOverReason(go_.reason);
                playGameEndSound();
                break;
            }
            case 'ERROR': {
                const err = data as ErrorMsg;
                setError(err.message);
                setTimeout(() => setError(''), 3000);
                break;
            }
        }
    }, []);

    useEffect(() => {
        const ws = new ChessWebSocket(gameId, playerColor, handleMessage);
        ws.setOnOpen(() => {
            setConnected(true);
            playGameStartSound();
        });
        ws.setOnClose(() => setConnected(false));
        ws.connect();
        wsRef.current = ws;

        return () => {
            ws.disconnect();
        };
    }, [gameId, playerColor, handleMessage]);

    const handleMove = useCallback((from: number, to: number, promotion: number) => {
        wsRef.current?.sendMove(from, to, promotion);
    }, []);

    const getResultIcon = () => {
        if (gameResult === 'draw') return '🤝';
        const playerWins =
            (playerColor === 'white' && gameResult === 'white_wins') ||
            (playerColor === 'black' && gameResult === 'black_wins');
        return playerWins ? '🏆' : '💀';
    };

    const getResultTitle = () => {
        if (gameResult === 'draw') return 'Draw';
        const playerWins =
            (playerColor === 'white' && gameResult === 'white_wins') ||
            (playerColor === 'black' && gameResult === 'black_wins');
        return playerWins ? 'You Won!' : 'You Lost';
    };

    const getResultMessage = () => {
        const reasons: Record<string, string> = {
            checkmate: 'by checkmate',
            stalemate: 'Stalemate',
            'white king timeout': 'White ran out of time',
            'black king timeout': 'Black ran out of time',
            '50-move rule': '50-move rule',
        };
        return reasons[gameOverReason] || gameOverReason;
    };

    // Determine which timer/info goes on top vs bottom
    const isWhitePlayer = playerColor === 'white';
    const opponentColor = isWhitePlayer ? 'black' : 'white';
    const opponentTime = isWhitePlayer ? blackTime : whiteTime;
    const myTime = isWhitePlayer ? whiteTime : blackTime;
    const opponentActive = sideToMove === opponentColor && !isGameOver;
    const myActive = sideToMove === playerColor && !isGameOver;
    const opponentTimeDelta = isWhitePlayer ? blackTimeDelta : whiteTimeDelta;
    const myTimeDelta = isWhitePlayer ? whiteTimeDelta : blackTimeDelta;

    return (
        <div className="game-page">
            <div className="game-header">
                <div className="game-header-left">
                    <span className="game-logo">♟ Chess Arena</span>
                    <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
                </div>
                <button className="btn btn--ghost" onClick={onLeave}>← Leave</button>
            </div>

            <div className="game-layout">
                <div className="board-column">
                    {/* Opponent — top */}
                    <div className={`player-card player-card--top ${opponentActive ? 'player-card--active' : ''}`}>
                        <div className="player-info-section">
                            <div className="player-avatar">
                                {opponentColor === 'white' ? '♔' : '♚'}
                            </div>
                            <span className="player-name">
                                {opponentColor === 'white' ? 'White' : 'Black'}
                            </span>
                        </div>
                        <Timer
                            timeMs={opponentTime}
                            isActive={opponentActive}
                            isLow={opponentTime < 10000}
                            timeDelta={opponentTimeDelta}
                        />
                    </div>

                    <ChessBoard
                        board={board}
                        legalMoves={legalMoves}
                        sideToMove={sideToMove}
                        playerColor={playerColor}
                        isCheck={isCheck}
                        lastMoveFrom={lastMoveFrom}
                        lastMoveTo={lastMoveTo}
                        isGameOver={isGameOver}
                        onMove={handleMove}
                    />

                    {/* You — bottom */}
                    <div className={`player-card player-card--bottom ${myActive ? 'player-card--active' : ''}`}>
                        <div className="player-info-section">
                            <div className="player-avatar">
                                {playerColor === 'white' ? '♔' : '♚'}
                            </div>
                            <span className="player-name">
                                {playerColor === 'white' ? 'White' : 'Black'} (You)
                            </span>
                        </div>
                        <Timer
                            timeMs={myTime}
                            isActive={myActive}
                            isLow={myTime < 10000}
                            timeDelta={myTimeDelta}
                        />
                    </div>
                </div>

                <div className="game-sidebar">
                    <div className="sidebar-card">
                        <h3>Game Info</h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {isGameOver
                                ? 'Game Over'
                                : myActive
                                    ? '🟢 Your turn'
                                    : '⏳ Opponent\'s turn'}
                        </div>
                        {isCheck && !isGameOver && (
                            <div style={{ marginTop: '8px', color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                                ⚡ Check!
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="error-flash">{error}</div>
                    )}
                </div>
            </div>

            {isGameOver && (
                <div className="game-over-overlay">
                    <div className="game-over-modal">
                        <div className="game-over-icon">{getResultIcon()}</div>
                        <h2>{getResultTitle()}</h2>
                        <p className="game-over-result">{getResultMessage()}</p>
                        <div className="game-over-buttons">
                            <button className="btn btn--primary" onClick={onLeave}>
                                Play Again
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Game;
