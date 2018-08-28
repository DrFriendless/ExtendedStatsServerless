import { Component, OnDestroy, AfterViewInit, Input } from '@angular/core';
import {Collection, GameData} from "extstats-core";
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'rating-by-ranking-graph',
  templateUrl: './rating-by-ranking-graph.component.html'
})
export class RatingByRankingGraphComponent implements OnDestroy, AfterViewInit {
  @Input('data') data$: Observable<Collection>;
  private subscription: Subscription;
  public rows = [];

  constructor() { }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public ngAfterViewInit() {
    this.subscription = this.data$.subscribe(collection => this.processData(collection));
  }

  private processData(collection: Collection) {
    const result = [];
    const gamesIndex = RatingByRankingGraphComponent.makeGamesIndex(collection.games);
    const max = Math.max(...collection.games.map(game => game.bggRanking));
    let row = [];
    row["title"] = "1-100";
    for (let i=0; i<=max; i++) {
      row.push({ rating: 0 });
      if (row.length === 100) {
        result.push(row);
        row = [];
        row["title"] = (i+1).toString() + "-" + (i+100).toString();
      }
    }
    if (row.length > 0) {
      result.push(row);
    }
    collection.collection.forEach(gg => {
      const ranking = gamesIndex[gg.bggid].bggRanking;
      if (ranking) {
        const r = Math.floor((ranking - 1) / 100);
        const c = (ranking - 1) - r * 100;
        result[r][c].tooltip = gamesIndex[gg.bggid].name;
        if (result[r][c].tooltip) result[r][c].tooltip = "#" + ranking.toString() + " " + result[r][c].tooltip;
          if (gg.rating > 0) {
          result[r][c].rating = RatingByRankingGraphComponent.roundRating(gg.rating);
          if (result[r][c].tooltip) result[r][c].tooltip += (" (" + gg.rating.toString() + ")");
        }
      }
    });
    this.rows = result;
  }

  private static roundRating(r: number): number {
    let rating = Math.round(r);
    if (rating < 1) rating = 1;
    if (rating > 10) rating = 10;
    return rating;
  }

  private static makeGamesIndex(games: GameData[]): { [bggid: number]: GameData } {
    const result = {};
    games.forEach(gd => result[gd.bggid] = gd);
    return result;
  }
}
