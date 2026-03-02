import React, { useMemo, useState, useEffect } from 'react';
import Square from './Square';
import type { SquareInfo, LegalMoveInfo } from '../services/api';

interface ChessBoardProps {
    board: SquareInfo[];
    legalMoves: LegalMoveInfo[];
    sideToMove: string;
    playerColor: string;
    isCheck: boolean;
    lastMoveFrom: number;
    lastMoveTo: number;
    isGameOver: boolean;
    onMove: (from: number, to: number, promotion: number) => void;
}

const ChessBoard: React.FC<ChessBoardProps> = ({
    board,
    legalMoves,
    sideToMove,
    playerColor,
    isCheck,
    lastMoveFrom,
    lastMoveTo,
    isGameOver,
    onMove,
}) => {
    const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
    const [promotionPending, setPromotionPending] = useState<{ from: number; to: number } | null>(null);
    const [checkFlash, setCheckFlash] = useState(false);

    // Flash the board when check happens
    useEffect(() => {
        if (isCheck && !isGameOver) {
            setCheckFlash(true);
            const t = setTimeout(() => setCheckFlash(false), 600);
            return () => clearTimeout(t);
        }
    }, [isCheck, isGameOver, sideToMove]);

    const flipped = playerColor === 'black';

    const legalTargets = useMemo(() => {
        if (selectedSquare === null) return new Set<number>();
        return new Set(
            legalMoves
                .filter((m) => m.from === selectedSquare)
                .map((m) => m.to)
        );
    }, [selectedSquare, legalMoves]);

    const needsPromotion = (from: number, to: number): boolean => {
        return legalMoves.some(
            (m) => m.from === from && m.to === to && m.promotion > 0
        );
    };

    const checkSquare = useMemo(() => {
        if (!isCheck) return -1;
        for (let i = 0; i < 64; i++) {
            if (board[i]?.piece === 'K' && board[i]?.color === sideToMove) {
                return i;
            }
        }
        return -1;
    }, [isCheck, board, sideToMove]);

    const handleSquareClick = (index: number) => {
        if (isGameOver) return;
        if (sideToMove !== playerColor) return;

        if (selectedSquare === null) {
            const sq = board[index];
            if (sq?.piece && sq?.color === playerColor) {
                setSelectedSquare(index);
            }
        } else {
            if (index === selectedSquare) {
                setSelectedSquare(null);
            } else if (legalTargets.has(index)) {
                if (needsPromotion(selectedSquare, index)) {
                    setPromotionPending({ from: selectedSquare, to: index });
                } else {
                    onMove(selectedSquare, index, 0);
                    setSelectedSquare(null);
                }
            } else {
                const sq = board[index];
                if (sq?.piece && sq?.color === playerColor) {
                    setSelectedSquare(index);
                } else {
                    setSelectedSquare(null);
                }
            }
        }
    };

    const handlePromotion = (pieceType: number) => {
        if (promotionPending) {
            onMove(promotionPending.from, promotionPending.to, pieceType);
            setPromotionPending(null);
            setSelectedSquare(null);
        }
    };

    const renderBoard = () => {
        const squares: React.ReactNode[] = [];
        for (let visualRow = 0; visualRow < 8; visualRow++) {
            for (let visualCol = 0; visualCol < 8; visualCol++) {
                const rank = flipped ? visualRow : 7 - visualRow;
                const file = flipped ? 7 - visualCol : visualCol;
                const index = rank * 8 + file;
                const isLight = (rank + file) % 2 !== 0;
                const sq = board[index] || { piece: '', color: '' };

                squares.push(
                    <Square
                        key={index}
                        index={index}
                        piece={sq.piece}
                        pieceColor={sq.color}
                        isLight={isLight}
                        isSelected={selectedSquare === index}
                        isLegalTarget={legalTargets.has(index)}
                        isLastMoveFrom={lastMoveFrom === index}
                        isLastMoveTo={lastMoveTo === index}
                        isCheck={checkSquare === index}
                        onClick={handleSquareClick}
                    />
                );
            }
        }
        return squares;
    };

    const fileLabels = flipped ? 'hgfedcba' : 'abcdefgh';
    const rankLabels = flipped ? '12345678' : '87654321';

    return (
        <div className="board-container">
            <div className="rank-labels">
                {rankLabels.split('').map((label, i) => (
                    <div key={i} className="coord-label">{label}</div>
                ))}
            </div>

            <div className="board-wrapper">
                <div className={`chessboard ${checkFlash ? 'chessboard--check' : ''}`}>
                    {renderBoard()}
                </div>

                <div className="file-labels">
                    {fileLabels.split('').map((label, i) => (
                        <div key={i} className="coord-label">{label}</div>
                    ))}
                </div>
            </div>

            {promotionPending && (
                <div className="promotion-overlay">
                    <div className="promotion-modal">
                        <h3>Promote to:</h3>
                        <div className="promotion-options">
                            {[
                                { type: 4, label: '♛', name: 'Queen' },
                                { type: 3, label: '♜', name: 'Rook' },
                                { type: 2, label: '♝', name: 'Bishop' },
                                { type: 1, label: '♞', name: 'Knight' },
                            ].map((opt) => (
                                <button
                                    key={opt.type}
                                    className="promotion-btn"
                                    onClick={() => handlePromotion(opt.type)}
                                    title={opt.name}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChessBoard;
