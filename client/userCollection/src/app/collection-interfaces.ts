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
