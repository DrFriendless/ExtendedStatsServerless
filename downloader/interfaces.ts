export interface FileToProcess {
    processMethod: string,
    url: string,
    bggid: number,
    geek: string
}

export interface ToProcessElement extends FileToProcess {
    lastUpdate: any,
    nextUpdate: any,
    tillNextUpdate: any,
    description: string,
    lastattempt: any,
    last_scheduled: any;
    bggid: number;
}

export interface ProcessUserResult {
    geek: string;
    bggid: number;
    country: string;
    url: string;
}

export interface ProcessCollectionResult {
    geek: string;
    items: CollectionGame[];
}

export interface CollectionGame {
    gameId: number;
    rating: number;
    owned: boolean;
    forTrade: boolean;
    want: boolean;
    wantToPlay: boolean;
    wantToBuy: boolean;
    preordered: boolean;
    wishListPriority: number;
    prevOwned: boolean;
}

export interface ProcessGameResult {
    gameId: number;
    name: string;
    average: number;
    rank: number;
    yearPublished: number;
    minPlayers: number;
    maxPlayers: number;
    playTime: number;
    usersRated: number;
    usersTrading: number;
    usersWanting: number;
    usersWishing: number;
    averageWeight: number;
    bayesAverage: number;
    numComments: number;
    expansion: number;
    usersOwned: number;
    subdomain: string;
    expands: number[];
    url: string;
    categories: string[];
    mechanics: string[];
    designers: number[];
    publishers: number[];
}

export interface CleanUpCollectionResult {
    geek: string;
    url: string;
    items: number[];
}

export interface MonthPlayed {
    month: number;
    year: number;
}

export interface ProcessMonthsPlayedResult {
    geek: string;
    monthsPlayed: MonthPlayed[];
    url: string;
}