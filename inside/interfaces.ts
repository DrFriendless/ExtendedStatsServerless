export interface FileToProcess {
    processMethod: string,
    url: string
}

export interface ProcessUserInvocation {
    geek: string,
    url: string
}

export interface ToProcessElement extends ProcessUserInvocation, FileToProcess {
    filename: string,
    lastUpdate: any,
    nextUpdate: any,
    tillNextUpdate: any,
    description: string,
    lastattempt: any,
    last_scheduled: any;
}

export interface ProcessUserResult {
    geek: string;
    bggid: number;
    country: string;
    url: string;
}

export interface ProcessCollectionResult {
    geek: string;
    items: [CollectionGame];
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
