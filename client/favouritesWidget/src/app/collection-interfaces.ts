export interface GeekGameQuery {
  geek: string;
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
  bggRating: number;
  bggRanking: number;
  yearPublished: number;
  minPlayers: number;
  maxPlayers: number;
  playTime: number;
  subdomain: string;
  weight: number;
  isExpansion: boolean;
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

export interface Collection {
  collection: GeekGame[];
  games: GameData[];
}

export interface CollectionWithPlays {
  collection: GeekGame[];
  plays: GamePlays[];
  lastYearPlays: GamePlays[];
  games: GameData[];
}
