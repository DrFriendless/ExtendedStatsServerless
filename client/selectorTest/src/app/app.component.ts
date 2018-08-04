import {AfterViewInit, Component} from '@angular/core';
import {Collection, GameData, GeekGame, GeekGameQuery} from "./collection-interfaces";
import {Subscription} from "rxjs/internal/Subscription";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {UserCollectionRow} from "./interfaces";
import {Subject} from "rxjs/internal/Subject";
import {Observable} from "rxjs/internal/Observable";
import {flatMap, tap} from "rxjs/operators";
import {fromExtStatsStorage} from "../../../userCollection/src/app/extstats-storage";

@Component({
  selector: 'extstats-selector-test',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class SelectorTestComponent implements AfterViewInit {
  private loadData$: Observable<Object>;
  public rows = [] as UserCollectionRow[];
  private subscription: Subscription;
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
      tap(q => "Sending query to server..."),
      flatMap(q => this.http.post("https://api.drfriendless.com/v1/collection", q, options))
    );
    this.subscription = this.loadData$.subscribe(result => {
      const data = result as Collection;
      console.log("This is the data that came back from the server.");
      console.log(data);
      if (!data.collection) {
        console.log("No games came back. Maybe the selector is broken.");
        this.rows = [];
      } else {
        this.rows = SelectorTestComponent.makeRows(data.collection, data.games);
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
  }}
