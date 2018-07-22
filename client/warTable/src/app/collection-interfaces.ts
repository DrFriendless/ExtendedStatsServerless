export interface GeekGameQuery {
  geek: string;
}

export interface GeekGame {
  bggid: number;
  name: string;
  rating: number;
  average:  number;
  owned: boolean;
  wantToBuy: boolean;
  wantToPlay: boolean;
  preordered: boolean;
  prevOwned: boolean;
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
