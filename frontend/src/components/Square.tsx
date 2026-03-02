import React from 'react';
import { getPieceImageUrl } from '../pieces';

interface SquareProps {
    index: number;
    piece: string;
    pieceColor: string;
    isLight: boolean;
    isSelected: boolean;
    isLegalTarget: boolean;
    isLastMoveFrom: boolean;
    isLastMoveTo: boolean;
    isCheck: boolean;
    isHovered: boolean;
    isDragSource: boolean;
    onClick: (index: number) => void;
    onDragStart: (index: number, e: React.MouseEvent | React.TouchEvent) => void;
}

const Square: React.FC<SquareProps> = ({
    index,
    piece,
    pieceColor,
    isLight,
    isSelected,
    isLegalTarget,
    isLastMoveFrom,
    isLastMoveTo,
    isCheck,
    isHovered,
    isDragSource,
    onClick,
    onDragStart,
}) => {
    let className = 'square';
    className += isLight ? ' square--light' : ' square--dark';
    if (isSelected) className += ' square--selected';
    if (isLastMoveFrom || isLastMoveTo) className += ' square--last-move';
    if (isCheck) className += ' square--check';
    if (isHovered) className += ' square--hover';

    const pieceUrl = piece && pieceColor ? getPieceImageUrl(pieceColor, piece) : null;

    const handleMouseDown = (e: React.MouseEvent) => {
        if (piece && pieceColor) {
            onDragStart(index, e);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (piece && pieceColor) {
            onDragStart(index, e);
        }
    };

    return (
        <div
            className={className}
            onClick={() => onClick(index)}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            data-square={index}
        >
            {isLegalTarget && !piece && <div className="legal-dot" />}
            {isLegalTarget && piece && <div className="capture-ring" />}
            {pieceUrl && !isDragSource && (
                <img
                    src={pieceUrl}
                    alt=""
                    className="piece-img"
                    draggable={false}
                />
            )}
            {/* Show ghost piece on drag source */}
            {pieceUrl && isDragSource && (
                <img
                    src={pieceUrl}
                    alt=""
                    className="piece-img piece-img--ghost"
                    draggable={false}
                />
            )}
        </div>
    );
};

export default React.memo(Square);
