export interface AuthResultCode {
    type: "code";
    code: string;
}
export interface AuthResultLoginSuccess {
    type: "userdata";
    data: any;
}
export interface AuthResultFailure {
    type: "failure";
    state: string;
}
export type AuthResult = AuthResultCode | AuthResultLoginSuccess | AuthResultFailure;

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
    post_title: string;
    poster: string;
    comment: string;
    date: Date;
    reply_to?: number;
    deleted?: boolean;
}

export interface NewsItem {
    id: number;
    date: string;
    html: string;
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
    gindex: number;
    hrindex: number;
    preordered: number;
}

export interface GeekSummary {
    warData?: WarTableRow;
    rated: number;
    average: number;
    monthsPlayed: number;
    error?: string;
    geekId?: number;
}

export interface SystemStats {
    userRows: number;
    gameRows: number;
    geekGamesRows: number;
    expansionRows: number;
    mechanics: number;
    categories: number;
    gameMechanics: number;
    gameCategories: number;
    notGames: number;
    fileRows: TypeCount[];
    ggForZero: number;
    distinctGGOwners: number;
    playsRows: number;
    normalisedPlaysRows: number;
    upcoming: {
        type: string;
        count: number;
    }[][];
    last24: {
        type: string;
        count: number;
    }[];
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
    ranking: number;
    hindex: number;
    gindex: number;
}

export interface FAQCount {
    day: number;
    week: number;
    month: number;
    year: number;
    ever: number;
}

export interface DisambiguationGame {
    bggid: number;
    name: string;
}

export interface DisambiguationItem {
    expansion: DisambiguationGame;
    basegames: DisambiguationGame[];
}

export interface AmbiguousPlay extends DisambiguationGame {
    year: number;
}

export interface DisambiguationData {
    geek: string;
    items: DisambiguationItem[];
    plays: AmbiguousPlay[];
}

export interface ToProcessSummary {
    lastUpdate: any;
    nextUpdate: any;
    description: string;
    lastattempt: any;
    last_scheduled: any;
    id: number;
    processMethod: string;
    url: string;
    bggid: number;
    geek: string;
    month: number;
    year: number;
    geekid: number;
}

export interface TypeCount {
    type: string;
    existing: number;
    waiting: number;
    unprocessed: number;
}

export interface GeekGame {
    bggid: number;
    rating: number;
    owned: boolean;
    wantToBuy: boolean;
    wantToPlay: boolean;
    preordered: boolean;
    prevOwned: boolean;
}

export interface GameData {
    bggid: number;
    name: string;
    n: string;
    bggRating: number;
    rt: number;
    bggRanking: number;
    rk: number;
    yearPublished: number;
    yp: number;
    minPlayers: number;
    min: number;
    maxPlayers: number;
    max: number;
    playTime: number;
    pt: number;
    subdomain: string;
    sub: string;
    usersOwned: number;
    weight: number;
    w: number;
    isExpansion: boolean;
    e: boolean;
}

export interface MonthlyPlays {
    year: number;
    month: number;
    game: number;
    expansion: boolean;
    quantity: number;
}

export interface MonthlyPlayCount {
    year: number;
    month: number;
    count: number;
}

export interface Plays {
    geek?: string;
    game: number;
    expansions?: number[];
    quantity: number;
}

export interface PlaysWithDate extends Plays {
    year: number;
    month: number;
    date: number;
}

export interface GameDataShort {
    bggid: number;
    n: string;
    rt: number;
    rk: number;
    yp: number;
    min: number;
    max: number;
    pt: number;
    sub: string;
    w: number;
    e: boolean;
}

export interface SelectorMetadata {
    game: number;
    colour?: string;
    owner?: string;
    player?: string;
    rater?: string;
}

export interface UserData {
    config: any;
    userName: string;
    created: Date;
    lastLogin: Date | undefined;
    loginCount: number;
}

export interface DesignerGameResult {
    bggid: number;
    name: string;
    bggRating: number;
    bggRanking: number;
    rating: number;
    owned: boolean;
    prevOwned: boolean;
    wtb: boolean;
    wtp: boolean;
    wit: boolean;
    plays: number;
}

export interface DesignerResult {
    bggid: number;
    score: number;
    name: string;
    games?: DesignerGameResult[];
}

export interface CatalistMetadata {
    tags: string[];
    mechanics: string[];
    categories: string[];
}

export interface Designer {
    bggid: number;
    name: string;
}