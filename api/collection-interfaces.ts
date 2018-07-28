export interface GeekGameQuery {
    geek: string;
}

export interface GeekGame {
    bggid: number;
    name: string;
    rating: number;
    average:  number;
    owned: boolean;
    wantToBuy: boolean;
    wantToPlay: boolean;
    preordered: boolean;
    prevOwned: boolean;
}

export interface WarTableRow {
    geek: number;
    geekName: string;
    totalPlays: number;
    distinctGames: number;
    top50: number;
    sdj: number;
    owned: number;
    want: number;
    wish: number;
    trade: number;
    prevOwned: number;
    friendless: number;
    cfm: number;
    utilisation: number;
    tens: number;
    zeros: number;
    ext100: number;
    hindex: number;
    preordered: number;
}

export interface GamePlays {
    game: number;
    plays: number;
    expansion: boolean;
    firstPlay: number;
    lastPlay: number;
    distinctYears: number;
    distinctMonths: number;
}

export interface CollectionWithPlays {
    collection: GeekGame[];
    plays: GamePlays[];
}

export interface GameSummary {
    bggid: number;
    name: string;
    bggRating: number;
    bggRanking: number;
}

