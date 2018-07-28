import {AfterViewInit, Component, OnDestroy} from '@angular/core';
import {fromExtStatsStorage} from "./extstats-storage";
import {CollectionWithPlays, GamePlays, GeekGameQuery} from "./collection-interfaces";
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
    const playsIndex = FavouritesComponent.makePlaysIndex(plays);
    const rows = [] as FavouritesRow[];
    collection.forEach(gg => {
      const gp = playsIndex[gg.bggid] || { plays: 0, expansion: false, game: gg.bggid } as GamePlays;
      const row = { gameName: gg.name, game: gg.bggid, rating: gg.rating, plays: gp.plays } as FavouritesRow;
      rows.push(row);
    });
    return rows;
  }

  private static makePlaysIndex(plays: GamePlays[]): object {
    const result = [];
    plays.forEach(gp => {
      result[gp.game] = gp;
    });
    return result;
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
