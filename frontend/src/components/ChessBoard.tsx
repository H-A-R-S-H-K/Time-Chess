import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import Square from './Square';
import { getPieceImageUrl } from '../pieces';
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

const SQUARE_SIZE = 72;

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
    const [hoverSquare, setHoverSquare] = useState<number | null>(null);

    // Drag state
    const [dragging, setDragging] = useState(false);
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dragPiece, setDragPiece] = useState<{ piece: string; color: string } | null>(null);
    const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const boardRef = useRef<HTMLDivElement>(null);

    const flipped = playerColor === 'black';

    // Flash the board on check
    useEffect(() => {
        if (isCheck && !isGameOver) {
            setCheckFlash(true);
            const t = setTimeout(() => setCheckFlash(false), 600);
            return () => clearTimeout(t);
        }
    }, [isCheck, isGameOver, sideToMove]);

    const legalTargets = useMemo(() => {
        if (selectedSquare === null && dragFrom === null) return new Set<number>();
        const fromSq = dragFrom !== null ? dragFrom : selectedSquare;
        return new Set(
            legalMoves
                .filter((m) => m.from === fromSq)
                .map((m) => m.to)
        );
    }, [selectedSquare, dragFrom, legalMoves]);

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

    // Convert page coordinates to board square index
    const coordsToSquare = useCallback((pageX: number, pageY: number): number | null => {
        if (!boardRef.current) return null;
        const rect = boardRef.current.getBoundingClientRect();
        const x = pageX - rect.left;
        const y = pageY - rect.top;
        const sqSize = rect.width / 8;

        const col = Math.floor(x / sqSize);
        const row = Math.floor(y / sqSize);

        if (col < 0 || col > 7 || row < 0 || row > 7) return null;

        const rank = flipped ? row : 7 - row;
        const file = flipped ? 7 - col : col;
        return rank * 8 + file;
    }, [flipped]);

    // Drag handlers
    const handleDragStart = useCallback((index: number, e: React.MouseEvent | React.TouchEvent) => {
        if (isGameOver) return;
        if (sideToMove !== playerColor) return;

        const sq = board[index];
        if (!sq?.piece || sq?.color !== playerColor) return;

        e.preventDefault();
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };

        setDragging(true);
        setDragFrom(index);
        setDragPiece({ piece: sq.piece, color: sq.color });
        setDragPos(pos);
        setSelectedSquare(index);
    }, [isGameOver, sideToMove, playerColor, board]);

    // Mouse/touch move during drag
    useEffect(() => {
        if (!dragging) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            const pos = 'touches' in e
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX, y: e.clientY };
            setDragPos(pos);

            // Update hover square
            const sq = coordsToSquare(pos.x, pos.y);
            setHoverSquare(sq);
        };

        const handleEnd = (e: MouseEvent | TouchEvent) => {
            const pos = 'changedTouches' in e
                ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
                : { x: e.clientX, y: e.clientY };

            const targetSq = coordsToSquare(pos.x, pos.y);

            if (targetSq !== null && dragFrom !== null && targetSq !== dragFrom) {
                const fromSq = dragFrom;
                const legalSet = new Set(
                    legalMoves.filter((m) => m.from === fromSq).map((m) => m.to)
                );
                if (legalSet.has(targetSq)) {
                    if (needsPromotion(fromSq, targetSq)) {
                        setPromotionPending({ from: fromSq, to: targetSq });
                    } else {
                        onMove(fromSq, targetSq, 0);
                    }
                }
            }

            setDragging(false);
            setDragFrom(null);
            setDragPiece(null);
            setHoverSquare(null);
            setSelectedSquare(null);
        };

        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [dragging, dragFrom, legalMoves, coordsToSquare, onMove]);

    const handleSquareClick = (index: number) => {
        if (dragging) return;
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

    // Handle mouse hover on board
    const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
        if (dragging) return;
        const sq = coordsToSquare(e.clientX, e.clientY);
        setHoverSquare(sq);
    }, [dragging, coordsToSquare]);

    const handleBoardMouseLeave = useCallback(() => {
        if (!dragging) setHoverSquare(null);
    }, [dragging]);

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
                        isHovered={hoverSquare === index}
                        isDragSource={dragFrom === index && dragging}
                        onClick={handleSquareClick}
                        onDragStart={handleDragStart}
                    />
                );
            }
        }
        return squares;
    };

    const fileLabels = flipped ? 'hgfedcba' : 'abcdefgh';
    const rankLabels = flipped ? '12345678' : '87654321';

    // Get drag piece image URL
    const dragPieceUrl = dragPiece ? getPieceImageUrl(dragPiece.color, dragPiece.piece) : null;

    return (
        <div className="board-container">
            <div className="rank-labels">
                {rankLabels.split('').map((label, i) => (
                    <div key={i} className="coord-label">{label}</div>
                ))}
            </div>

            <div className="board-wrapper">
                <div
                    ref={boardRef}
                    className={`chessboard ${checkFlash ? 'chessboard--check' : ''}`}
                    onMouseMove={handleBoardMouseMove}
                    onMouseLeave={handleBoardMouseLeave}
                >
                    {renderBoard()}
                </div>

                <div className="file-labels">
                    {fileLabels.split('').map((label, i) => (
                        <div key={i} className="coord-label">{label}</div>
                    ))}
                </div>
            </div>

            {/* Dragged piece follows cursor */}
            {dragging && dragPieceUrl && (
                <img
                    src={dragPieceUrl}
                    alt=""
                    className="drag-piece"
                    style={{
                        left: dragPos.x - SQUARE_SIZE / 2,
                        top: dragPos.y - SQUARE_SIZE / 2,
                        width: SQUARE_SIZE,
                        height: SQUARE_SIZE,
                    }}
                    draggable={false}
                />
            )}

            {/* Promotion modal */}
            {promotionPending && (
                <div className="promotion-overlay">
                    <div className="promotion-modal">
                        <h3>Promote to:</h3>
                        <div className="promotion-options">
                            {[
                                { type: 4, piece: 'Q', name: 'Queen' },
                                { type: 3, piece: 'R', name: 'Rook' },
                                { type: 2, piece: 'B', name: 'Bishop' },
                                { type: 1, piece: 'N', name: 'Knight' },
                            ].map((opt) => {
                                const url = getPieceImageUrl(playerColor, opt.piece);
                                return (
                                    <button
                                        key={opt.type}
                                        className="promotion-btn"
                                        onClick={() => handlePromotion(opt.type)}
                                        title={opt.name}
                                    >
                                        {url && <img src={url} alt={opt.name} className="promotion-piece-img" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChessBoard;
