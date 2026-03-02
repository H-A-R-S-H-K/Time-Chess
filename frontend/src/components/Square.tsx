import React from 'react';

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
    onClick: (index: number) => void;
}

const PIECE_UNICODE: Record<string, Record<string, string>> = {
    white: { P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' },
    black: { P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' },
};

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
    onClick,
}) => {
    let className = 'square';
    className += isLight ? ' square--light' : ' square--dark';
    if (isSelected) className += ' square--selected';
    if (isLastMoveFrom || isLastMoveTo) className += ' square--last-move';
    if (isCheck) className += ' square--check';

    const pieceChar = piece && pieceColor ? PIECE_UNICODE[pieceColor]?.[piece] : '';

    return (
        <div
            className={className}
            onClick={() => onClick(index)}
            data-square={index}
        >
            {isLegalTarget && !piece && <div className="legal-dot" />}
            {isLegalTarget && piece && <div className="capture-ring" />}
            {pieceChar && (
                <span className={`piece piece--${pieceColor}`}>{pieceChar}</span>
            )}
        </div>
    );
};

export default React.memo(Square);
