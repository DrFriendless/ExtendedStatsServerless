import {AfterViewInit, Component} from '@angular/core';
import {Subscription} from "rxjs/internal/Subscription";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {UserCollectionRow, fromExtStatsStorage, Collection, GameData, GeekGame, GeekGameQuery, SelectorMetadataSet} from "extstats-core";
import {Subject} from "rxjs/internal/Subject";
import {Observable} from "rxjs/internal/Observable";
import {flatMap, tap} from "rxjs/operators";

@Component({
  selector: 'extstats-selector-test',
  templateUrl: './app.component.html'
})
export class SelectorTestComponent implements AfterViewInit {
  private loadData$: Observable<Object>;
  public rows = [] as UserCollectionRow[];
  private readonly subscription: Subscription;
  public me: string = "";
  public them: string = "";
  public selector: string = "owned(ME)";
  public showDoc = true;
  private queries = new Subject<GeekGameQuery>();

  constructor(private http: HttpClient) {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    this.loadData$ = this.queries.asObservable().pipe(
      tap(q => {
        console.log("Sending query to server...");
        console.log(q);
      }),
      flatMap(q => this.http.post("https://api.drfriendless.com/v1/collection", q, options))
    );
    this.subscription = this.loadData$.subscribe(result => {
      const data = result as Collection;
      console.log("This is the data that came back from the server.");
      console.log(data);
      Object.setPrototypeOf(data.metadata, SelectorMetadataSet.prototype);
      if (!data.collection) {
        console.log("No games came back. Maybe the selector is broken.");
        this.rows = [];
      } else {
        this.rows = SelectorTestComponent.makeRows(data.collection, data.games, data.metadata);
      }
    });
  }

  public ngAfterViewInit(): void {
    const geek = fromExtStatsStorage(storage => storage.geek);
    if (geek) this.me = geek;
  }

  public test() {
    const body: GeekGameQuery = {
      geek: this.me,
      query: this.selector,
      vars: {
        THEM: this.them
      }
    };
    console.log(body);
    this.queries.next(body);
  }

  private static makeRows(geekGames: GeekGame[], games: GameData[], metadata: SelectorMetadataSet): UserCollectionRow[] {
    const gameIndex = {};
    games.forEach(game => gameIndex[game.bggid] = game);
    const result = [];
    console.log(metadata);
    console.log(metadata.lookup);
    geekGames.forEach(gg => {
      const game = gameIndex[gg.bggid];
      const row = { bggid: gg.bggid, name: game.name, average: game.bggRating, rating: gg.rating } as UserCollectionRow;
      const meta = metadata.lookup(gg.bggid);
      if (meta) row["colour"] = meta.colour;
      result.push(row);
    });
    return result;
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }}
