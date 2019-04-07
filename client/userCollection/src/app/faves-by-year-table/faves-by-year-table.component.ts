import { Component, OnDestroy, AfterViewInit, Input } from '@angular/core';
import { Collection, GameData } from "extstats-core";
import { Observable } from "rxjs/internal/Observable";
import { Subscription } from "rxjs/internal/Subscription";

@Component({
  selector: 'faves-by-year-table',
  templateUrl: './faves-by-year-table.component.html'
})
export class FavesByYearTableComponent implements OnDestroy, AfterViewInit {
  @Input('data') data$: Observable<Collection>;
  private subscription: Subscription;
  public rows: { year: number, games: string[] }[] = [];

  constructor() { }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public ngAfterViewInit() {
    this.subscription = this.data$.subscribe(collection => this.processData(collection));
  }

  private processData(collection: Collection) {
    const byYear = {} as { [year: number]: string[] };
    const index = FavesByYearTableComponent.makeGamesIndex(collection.games);
    for (let gg of collection.collection) {
      if (gg.rating >= 8) {
        const game = index[gg.bggid];
        let games = byYear[game.yearPublished];
        if (!games) {
          games = [game.name];
          byYear[game.yearPublished] = games;
        } else {
          games.push(game.name);
        }
      }
    }
    const years = Object.keys(byYear).map(year => parseInt(year));
    years.sort((a, b) => a - b);
    const result = [];
    for (let year of years) {
      result.push({ year, games: byYear[year] });
    }
    console.log(result);
    this.rows = result;
  }

  private join(ss: string[]): string {
    return ss.join(", ");
  }

  private static makeGamesIndex(games: GameData[]): { [bggid: number]: GameData } {
    const result = {};
    games.forEach(gd => result[gd.bggid] = gd);
    return result;
  }
}
