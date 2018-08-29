import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import { Collection, fromExtStatsStorage, GeekGameQuery } from "extstats-core";
import { ExtstatsTable } from "extstats-angular";
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";
import {Subject} from "rxjs/internal/Subject";
import {flatMap, tap, map, share} from "rxjs/internal/operators";

@Component({
  selector: 'owned-collection',
  templateUrl: './app.component.html'
})
export class UserOwnedComponent implements ExtstatsTable, AfterViewInit {
  private static DEFAULT_SELECTOR = "owned(ME)";
  public data$: Observable<Collection>;
  private selectors = new Subject<string>();
  private selector: string = UserOwnedComponent.DEFAULT_SELECTOR;
  private geek: string;

  constructor(private http: HttpClient) {
    this.geek = fromExtStatsStorage(storage => storage.geek);
    this.data$ = this.selectors.asObservable()
      .pipe(
        flatMap(s => this.doQuery(s)),
        tap(data => console.log(data)),
        share()
      );
  }

  public ngAfterViewInit() {
    this.selectors.next(this.selector);
  }

  public getId(): string {
    return "rated";
  }

  public getSelector(): string {
    return this.selector;
  }

  public setSelector(s: string) {
    this.selector = s;
    this.selectors.next(s);
  }

  private doQuery(selector: string): Observable<Collection> {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    const body: GeekGameQuery = {
      query: selector,
      geek: this.geek,
      format: "Collection",
      vars: {}
    };
    console.log(body);
    return this.http.post("https://api.drfriendless.com/v1/query", body, options) as Observable<Collection>;
  }
}
