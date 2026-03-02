// Piece image URL mapping — uses cburnett SVG set from /public/pieces/
const PIECE_IMAGES: Record<string, Record<string, string>> = {
    white: {
        P: '/pieces/wP.svg',
        N: '/pieces/wN.svg',
        B: '/pieces/wB.svg',
        R: '/pieces/wR.svg',
        Q: '/pieces/wQ.svg',
        K: '/pieces/wK.svg',
    },
    black: {
        P: '/pieces/bP.svg',
        N: '/pieces/bN.svg',
        B: '/pieces/bB.svg',
        R: '/pieces/bR.svg',
        Q: '/pieces/bQ.svg',
        K: '/pieces/bK.svg',
    },
};

export function getPieceImageUrl(color: string, piece: string): string | null {
    return PIECE_IMAGES[color]?.[piece] ?? null;
}
