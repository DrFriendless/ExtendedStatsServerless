import {AfterViewInit, Component, OnDestroy} from '@angular/core';
import {fromExtStatsStorage} from "./extstats-storage";
import {CollectionWithPlays, GameData, GamePlays, GeekGameQuery} from "./collection-interfaces";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Subscription} from "rxjs/internal/Subscription";
import {FavouritesRow} from "./interfaces";

@Component({
  selector: 'extstats-favourites',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class FavouritesComponent implements OnDestroy, AfterViewInit {
  private readonly geek: string;
  private loadData$;
  private data: CollectionWithPlays;
  public rows: FavouritesRow[];
  private subscription: Subscription;

  constructor(private http: HttpClient) {
    this.geek = fromExtStatsStorage(storage => storage.geek);
  }

  public ngAfterViewInit(): void {
    if (!this.geek) return;
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    const body: GeekGameQuery = {
      geek: this.geek
    };
    console.log(body);
    this.loadData$ = this.http.post("https://api.drfriendless.com/v1/collectionWithPlays", body, options);
    this.subscription = this.loadData$.subscribe(result => {
      this.data = result;
      console.log(this.data);
      this.rows = FavouritesComponent.makeRows(this.data);
    })
  }

  private static makeRows(data: CollectionWithPlays): FavouritesRow[] {
    const collection = data.collection;
    const plays = data.plays;
    const games = data.games;
    console.log(games);
    const playsIndex = FavouritesComponent.makePlaysIndex(plays);
    const gamesIndex = FavouritesComponent.makeGamesIndex(games);
    const rows = [] as FavouritesRow[];
    collection.forEach(gg => {
      const gp = playsIndex[gg.bggid] || { plays: 0, expansion: false, game: gg.bggid } as GamePlays;
      const game = gamesIndex[gg.bggid] || { name: "Unknown", bggRanking: 1000000, bggRating: 1.0 } as GameData;
      const row = { gameName: game.name, game: gg.bggid, rating: gg.rating, plays: gp.plays, bggRanking: game.bggRanking,
        bggRating: game.bggRating, firstPlayed: FavouritesComponent.toDateString(gp.firstPlay),
        lastPlayed: FavouritesComponent.toDateString(gp.lastPlay) } as FavouritesRow;
      rows.push(row);
    });
    return rows;
  }

  private static toDateString(date: number): string {
    if (!date) return "";
    const y = Math.floor(date/10000);
    const m = Math.floor(date/100) % 100;
    const d = date % 100;
    const mm = (m < 10) ? "0" + m.toString() : m.toString();
    const dd = (d < 10) ? "0" + d.toString() : d.toString();
    return y.toString() + "-" + mm + "-" + dd;
  }

  private static makeGamesIndex(games: GameData[]): object {
    const result = {};
    games.forEach(gd => {
      result[gd.bggid] = gd;
    });
    return result;
  }

  private static makePlaysIndex(plays: GamePlays[]): object {
    const result = {};
    plays.forEach(gp => {
      result[gp.game] = gp;
    });
    return result;
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
