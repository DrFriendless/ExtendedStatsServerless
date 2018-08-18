export interface FavouritesRow {
  gameName: string;
  game: number;
  rating: number;
  plays: number;
  bggRanking: number;
  bggRating: number;
  firstPlayed: string;
  lastPlayed: string;
  monthsPlayed: number;
  yearsPlayed: number;
  hoursPlayed: number;
  fhm: number;
  hhm: number;
  ruhm: number;
  huberHeat: number;
  yearPublished: number;
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
}

export interface UserCollectionRow {
    name: string;
    bggid: number;
    average: number;
    rating: number;
}
