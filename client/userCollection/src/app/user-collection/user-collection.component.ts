import {
  AfterViewInit,
  Component, OnDestroy, ViewEncapsulation,
} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Subscription} from "rxjs/internal/Subscription";
import {GeekGame, GeekGameQuery} from "../collection-interfaces";
import {fromExtStatsStorage} from "../extstats-storage";
import {Collection, GameData} from "../../../../../api/collection-interfaces";
import {UserCollectionRow} from "./interfaces";

@Component({
  selector: 'user-collection',
  templateUrl: "./user-collection.component.html",
  styleUrls: ["./user-collection.component.css"],
  encapsulation: ViewEncapsulation.None
})
export class UserCollectionComponent implements OnDestroy, AfterViewInit {
  private geek: string;
  private loadData$;
  private data: Collection;
  public rows = [] as UserCollectionRow[];
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
      geek: this.geek,
      query: "owned(ME)"
    };
    console.log(body);
    this.loadData$ = this.http.post("https://api.drfriendless.com/v1/collection", body, options);
    this.subscription = this.loadData$.subscribe(result => {
      this.data = result;
      console.log(this.data);
      this.rows = UserCollectionComponent.makeRows(this.data.collection, this.data.games);
    });
  }

  private static makeRows(geekGames: GeekGame[], games: GameData[]): UserCollectionRow[] {
    const gameIndex = {};
    games.forEach(game => gameIndex[game.bggid] = game);
    const result = [];
    geekGames.forEach(gg => {
      const game = gameIndex[gg.bggid];
      const row = { bggid: gg.bggid, name: game.name, average: game.bggRating, rating: gg.rating } as UserCollectionRow;
      result.push(row);
    });
    return result;
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
