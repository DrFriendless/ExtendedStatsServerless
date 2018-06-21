export interface TypeCount {
   type: string;
   count: number;
}

export interface SystemStats {
    userRows: number;
    gameRows: number;
    geekGamesRows: number;
    fileRows: [TypeCount];
    waitingFileRows: [TypeCount]; // due
    unprocessedFileRows: [TypeCount]; // never processed
}
