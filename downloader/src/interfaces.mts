export interface FileToProcess {
    id: number;
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

export interface SeriesMetadataResult {
    name: string;
    games: number[];
}

export interface MetadataRuleResult {
    rule: number;
    game: number;
}
export interface Metadata {
    series: SeriesMetadataResult[];
    rules: MetadataRuleResult[];
}
export interface ProcessCollectionResult extends RequestStats {
    geek: string;
    items: CollectionGameResult[];
}
export interface CollectionGameResult {
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
export interface ProcessGameResult extends RequestStats {
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
export interface ProcessDesignerResult extends RequestStats {
    bggid: number;
    name: string;
    url: string;
}
export interface ProcessPublisherResult extends RequestStats {
    bggid: number;
    name: string;
    url: string;
}
export interface ProcessUserResult extends RequestStats {
    geek: string;
    bggid: number;
    country: string;
    url: string;
}
export interface MonthPlayedResult {
    month: number;
    year: number;
}
export interface MonthPlayedDataResult {
    geek: string;
    monthsPlayed: MonthPlayedResult[];
    url: string;
}
export interface PlayDataResult {
    quantity: number;
    location: string;
    date: string;
    gameid: number;
    id: number;
}
export interface ProcessPlaysResult extends RequestStats {
    geek: string;
    month: number;
    year: number;
    plays: PlayDataResult[];
    url: string;
}
export interface ProcessPlaysForPeriodResult extends RequestStats {
    url: string;
    processMethod: string;
    geek: string;
    startYmdInc: string;
    endYmdInc: string;
    plays: PlayDataResult[];
}
export interface CleanUpCollectionResult {
    geek: string;
    url: string;
    items: number[];
}
export type ProcessMethod = "processCollection" | "processMarket" | "processPlayed" | "processGame" | "processTop50" | "processFrontPage" | "processUser" | "processPlays" | "processDesigner" | "processPublisher";
export type UpdateUserListMessage = {
    discriminator: "UpdateUserListMessage";
    users: string[];
};
export type NoSuchGeekMessage = {
    discriminator: "NoSuchGeekMessage";
    geek: string;
};
export type NoSuchDesignerMessage = {
    discriminator: "NoSuchDesignerMessage";
    bggId: number;
};
export type NoSuchPublisherMessage = {
    discriminator: "NoSuchPublisherMessage";
    bggId: number;
};
export type UpdateMetadataMessage = {
    discriminator: "UpdateMetadataMessage";
    metadata: Metadata;
};
export type UpdateTop50Message = {
    discriminator: "UpdateTop50Message";
    top50: number[];
};
export type NoSuchGameMessage = {
    discriminator: "NoSuchGameMessage";
    gameId: number;
};
export type GameResultMessage = {
    discriminator: "GameResultMessage";
    result: ProcessGameResult;
};
export type UserResultMessage = {
    discriminator: "UserResultMessage";
    result: ProcessUserResult;
};
export type CollectionResultMessage = {
    discriminator: "CollectionResultMessage";
    result: ProcessCollectionResult;
};
export type MarkAsProcessedMessage = {
    discriminator: "MarkAsProcessedMessage";
    context: string;
    fileDetails: FileToProcess;
};
export type MarkAsUnprocessedMessage = {
    discriminator: "MarkAsUnprocessedMessage";
    context: string;
    fileDetails: FileToProcess;
};
export type MarkAsTryAgainMessage = {
    discriminator: "MarkAsTryAgainMessage";
    context: string;
    fileDetails: FileToProcess;
};
export type CleanUpCollectionMessage = {
    discriminator: "CleanUpCollectionMessage";
    params: CleanUpCollectionResult;
};
export type PlayedResultMessage = {
    discriminator: "PlayedResultMessage";
    monthsData: MonthPlayedDataResult;
};
export type PlaysForPeriodResultMessage = {
    discriminator: "PlaysForPeriodResultMessage";
    plays: ProcessPlaysForPeriodResult;
};
export type PlaysResultMessage = {
    discriminator: "PlaysResultMessage";
    result: ProcessPlaysResult;
};
export type DesignerResultMessage = {
    discriminator: "DesignerResultMessage";
    result: ProcessDesignerResult;
};
export type PublisherResultMessage = {
    discriminator: "PublisherResultMessage";
    result: ProcessPublisherResult;
};
export type EnsureGamesMessage = {
    discriminator: "EnsureGamesMessage";
    gameIds: number[];
};
export type SlowDownMessage = {
    discriminator: "SlowDownMessage";
};
export type MarkPlaysForPeriodProcessedMessage = {
    discriminator: "MarkPlaysForPeriodProcessed";
    url: string;
};
export type ReprocessPlaysMessage = {
    discriminator: "ReprocessPlays";
    geek: string;
};
export type RebuildMaterialisedViewsMessage = {
    discriminator: "RebuildMaterialisedViews";
};
export type UpdatePlayedYearsMessage = {
    discriminator: "UpdatePlayedYears";
    result: UpdatePlayedYearsResult;
}
export interface RequestStats {
    requestId: string;
    initiated: number;
    scheduled: number;
    downloaded: number;
    received: number;
    completed: number;
}
export interface PlayedYearsRequest extends RequestStats {
    geek: string;
    geekid: number;
    fileId: number;
}

export interface UpdatePlayedYearsResult extends RequestStats {
    geek: string;
    fileId: number;
    nextUpdate: Date;
    periods: {
        start: string;
        end: string;
    }[];
}
export type QueueMessage = UpdateUserListMessage | UpdateMetadataMessage | UpdateTop50Message | NoSuchGameMessage | GameResultMessage | UserResultMessage | CollectionResultMessage | MarkAsProcessedMessage | MarkAsUnprocessedMessage | MarkAsTryAgainMessage | CleanUpCollectionMessage | PlayedResultMessage | PlaysResultMessage | EnsureGamesMessage | NoSuchGeekMessage | PlaysForPeriodResultMessage | SlowDownMessage | MarkPlaysForPeriodProcessedMessage | DesignerResultMessage | PublisherResultMessage | ReprocessPlaysMessage | RebuildMaterialisedViewsMessage | NoSuchDesignerMessage | NoSuchPublisherMessage | UpdatePlayedYearsMessage;

export interface URLRequest {
    url: string;
    bggApiKey: string;
}

// properties common to all download requests
export interface AbstractDownloadRequest extends RequestStats {
    requests: URLRequest[];
    attempts: number;
}

// info to send the DownloadResult to a callback
export interface CallbackDownloadRequest extends AbstractDownloadRequest {
    type: "callback";
    callbackId: string;
}

// info to send the DownloadResult to a function invocation
export interface ContinuationDownloadRequest extends AbstractDownloadRequest {
    type: "continuation";
    functionName: string;
    continuationData: any;
}

export type DownloadRequest = CallbackDownloadRequest | ContinuationDownloadRequest;

export interface AbstractDownloadResult {
    url: string;
}

// we stored the data on S3
export interface S3DownloadResultType extends AbstractDownloadResult {
    type: "s3";
    bucket: string;
    objectKey: string;
}

// here is the complete data
export interface ContentDownloadResultType extends AbstractDownloadResult {
    type: "content";
    content: string;
}

// there was some sort of failure.
export interface FailureDownloadResultType extends AbstractDownloadResult {
    type: "failure";
    error: string;
}

export type DownloadResult = S3DownloadResultType | ContentDownloadResultType | FailureDownloadResultType;

export interface AbstractDownloadResponse extends RequestStats {
    attempts: number;
    results: DownloadResult[];
    requestId: string;
}

// This is what we will send to a newly invoked function.
export interface ContinuationDownloadResponse extends AbstractDownloadResponse {
    continuationData: any;
}

export interface FriendlessMetrics {
    friendless: number;
    utilisation: number;
    cfm: number;
}

export interface WarTableDatabaseRow {
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
    gindex: number;
    hrindex: number;
    preordered: number;
}
export interface RankingTableDatabaseRow {
    game: number;
    game_name: string;
    total_ratings: number;
    num_ratings: number;
    bgg_ranking: number;
    bgg_rating: number;
    normalised_ranking: number;
    total_plays: number;
    ranking: number;
    hindex: number;
    gindex: number;
}

export interface PlaysRow { 
    game: number;
    playDate: string;
    quantity: number;
    location: string;
}

export interface PlaysDataForWarTable {
    totalPlays: number;
    distinctGames: number;
    tens: number;
    zeros: number;
    hindex: number;
    gindex: number;
    hrindex: number;
    sdj: number;
    ext100: number;
    uses: number[];
}

// this is what the message broker is expecting
export interface WebsockMessage {
    users: string[];
    topics: string[];
    body: any;
}

export interface QueueInput {
    Records: {
        receiptHandle: string;
        body: string;
        awsRegion: string;
    }[]
}