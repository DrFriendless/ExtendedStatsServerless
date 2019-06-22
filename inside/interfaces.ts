export interface FileToProcess {
    processMethod: string;
    url: string;
    bggid: number;
    geek: string;
    month: number;
    year: number;
    geekid: number;
}

export interface ToProcessElement extends FileToProcess {
    lastUpdate: any;
    nextUpdate: any;
    description: string;
    lastattempt: any;
    last_scheduled: any;
}

export interface ProcessUserResult {
    geek: string;
    bggid: number;
    country: string;
    url: string;
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
    url: string;
    categories: string[];
    mechanics: string[];
    designers: number[];
    publishers: number[];
    expansions: number[];
}

export interface ProcessCollectionResult {
    geek: string;
    items: CollectionGame[];
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

export interface PlayData {
    quantity: number;
    location: string;
    date: string;
    gameid: number;
    raters: number;
    ratingsTotal: number;
}

export interface ProcessPlaysResult {
    geek: string;
    month: number;
    year: number;
    plays: PlayData[];
    url: string;
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


export interface CleanUpCollectionResult {
    geek: string;
    url: string;
    items: number[];
}


export interface SeriesMetadata {
    name: string;
    games: number[];
}

export const METADATA_RULE_BASEGAME = 1;

export interface MetadataRule {
    rule: number;
    game: number;
}

export interface Metadata {
    series: SeriesMetadata[];
    rules: MetadataRule[];
}

export interface NormalisedPlays {
    quantity: number;
    game: number;
    geek: number;
    date: number;
    month: number;
    year: number;
    baseplay: number;
    expansionPlay: boolean;
    id: number;
}

export interface WorkingNormalisedPlays extends NormalisedPlays {
    expansions: number[];
    isExpansion: boolean;
}

export interface ErrorMessage {
    first: Date;
    last: Date;
    source: string;
    message: string;
    count: number;
}
