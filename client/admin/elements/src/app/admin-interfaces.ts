export interface TypeCount {
  type: string;
  existing: number;
  waiting: number;
  unprocessed: number;
}

export interface SystemStats {
  userRows: number;
  gameRows: number;
  geekGamesRows: number;
  fileRows: [TypeCount];
}