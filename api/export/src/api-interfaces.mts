export interface GeeklistCheck {
    geek: string;
    geeklistId: number;
    items: GeeklistItemCheck[];
}

export interface GeeklistItemCheck {
    id: string;
    bggid: number;
    name: string;
    user: string;
    wtb: boolean;
    wtp: boolean;
    wit: boolean;
    rating: number;
    owned: boolean;
    prevOwned: boolean;
    wishlist: number;
}

export interface ProcessedRecRow {
    bggid: number;
    name: string;
    score: number;
    score0: number;
    score2: number;
    bggRating: number;
    bggRanking: number;
}

export interface MostPlayedEntry {
    bggid: number;
    name: string;
    geeks: number;
    plays: number;
    rating?: number;
    owned: boolean;
    wantToPlay: boolean;
    wantInTrade: boolean;
    wantToBuy: boolean;
    prevOwned: boolean;
    preordered: boolean;
    wish: number;
    forTrade: boolean;
    yourPlays: number;
}

export interface Hotness {
    year: number;
    geek: string;
    mostPlayed: MostPlayedEntry[];
    mostPlayedNew: MostPlayedEntry[];
}

export interface BlogComment {
    id: number;
    post_url: string;
    poster: string;
    comment: string;
    date: Date;
    reply_to?: number;
    deleted?: boolean;
}