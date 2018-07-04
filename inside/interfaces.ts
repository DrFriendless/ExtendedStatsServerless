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

export interface RankingTableRow {
    game: number;
    game_name: string;
    total_ratings: number;
    num_ratings: number;
    bgg_ranking: number;
    bgg_rating: number;
    normalised_ranking: number;
    total_plays: number;
}

export interface WarTableRow {
    geek: number;
    geekName: string;
    total_plays: number;
    distinct_games: number;
    top50: number;
    sdj: number;
    owned: number;
    want: number;
    wish: number;
    forTrade: number;
    prevOwned: number;
    friendless: number;
    cfm: number;
    utilisation: number;
    tens: number;
    zeros: number;
    mostVoters: number;
    top100: number;
    hindex: number;
}

export interface CleanUpCollectionResult {
    geek: string;
    url: string;
    items: number[];
}