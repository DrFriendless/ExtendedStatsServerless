import {GameData} from "extstats-core";

export interface GeekGameRow {
    geek: string;
    bggid: number;
    rating: number;
    owned: boolean;
    wantToBuy: boolean;
    wantToPlay: boolean;
    preordered: boolean;
    prevOwned: boolean;
    geekid: number;
    wantInTrade: boolean;
    wish: number;
    forTrade: boolean;
    normRating: number;
}

export interface RetrievePlay {
    id: number;
    bggid: number;
    quantity: number;
    ymd: number;
    year: number;
    month: number;
    day: number;
    geek: string;
    expansions: number[];
    location: string;
}


// a row from the games table
export interface RawGameData {
    bggid: number;
    name: string;
    average: number;
    rank: number;
    yearPublished: number;
    minPlayers: number;
    maxPlayers: number;
    playTime: number;
    subdomain: string;
    averageWeight: number;
    isExpansion: boolean;
}

export interface NormalisedPlay {
    id: number;
    game: number;
    geek: number;
    quantity: number;
    expansion_play: boolean;
    ymd: number;
    year: number;
    month: number;
    date: number;
    location?: string;
}

export interface PlayWithDate {
    game: number;
    quantity: number;
    ymd?: number;
    year?: number;
    month?: number;
    date?: number;
    expansions?: number[];
    location: string;
}

export interface ExtractedGameData extends GameData {

}

export interface ExpansionPlay {
    game: number;
    baseplay: number;
}

export interface AllPlaysQueryResult {
    game: number;
    x: number;
    q: number;
    mi: number;
    ma: number;
    years: number;
    months: number;
}

export interface MonthlyPlaysQueryResult {
    game: number;
    x: number;
    q: number;
    year: number;
    month: number;
}

export interface MonthlyCountsQueryResult {
    game: number;
    year: number;
    month: number;
    dates: number;
}

export interface LastYearQueryResult {
    game: number;
    x: number;
    q: number;
    months: number;
}

export interface ProcessMethodCount {
    processMethod: string;
    count: number;
}

export interface NormalisedPlaysQueryResult {
    game: number;
    q: number;
    x: number;
    lastPlayed: number;
    firstPlayed: number;
    years: number;
    months: number;
}

export interface LastYearPlaysQueryResult {
    game: number;
    q: number;
    months: number;
}

export interface ShouldPlayAdditionalData {
    shouldPlayScore: number;
    plays: number;
    years: number;
    months: number;
    expansion: boolean;
    lyPlays: number;
    lyMonths: number;
    lastPlay?: number;
    firstPlay?: number;
    daysSincePlayed?: number;
}

export interface PlaysRetrieveResult {
    geeks: string[];
    plays: RetrievePlay[];
    games: GameData[];
    geekgames: GeekGameRow[];
}

export interface RawPlaysQueryResult {
    ymd: number;
    id: number;
    bggid: number;
    geek: number;
    quantity: number;
    year: number;
    month: number;
    date: number;
    expansion_play: number;
    baseplay: number | undefined;
    location: string;
}

export interface SignupTaskData {
    type: "signup";
}
export interface ChangePasswordTaskData {
    type: "changePassword";
    password: string;
}

export type TaskData = SignupTaskData | ChangePasswordTaskData;

export interface AuthTask {
    id: number;
    created: Date;
    username: string;
    code: string;
    task: TaskData;
}

export interface AuthTableRow {
    configuration: any;
    created: Date;
    status: string;
    username: string;
    lastLogin?: Date;
    loginCount: number;
    password: string;
}

export interface GeekGamesTableRow {
    game: number;
    geekid: number;
    owned: number;
    plays: number;
    preordered: number;
    prevowned: number;
    rating: number;
    trade: number;
    want: number;
    wanttobuy: number;
    wanttoplay: number;
    wish: number;
    normrating: number;
}

export interface GameDesignersTableRow {
    designer: number;
    game: number;
}

export interface GamePublishersTableRow {
    publisher: number;
    game: number;
}
export interface SelectorMetadata {
    game: number;
    colour?: string;
    owner?: string;
    player?: string;
    rater?: string;
}