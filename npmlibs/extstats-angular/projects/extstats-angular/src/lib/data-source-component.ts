import { fromExtStatsStorage, GeekGameQuery } from "extstats-core";
import { AfterViewInit } from '@angular/core';
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";
import {Subject} from "rxjs/internal/Subject";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {flatMap, tap, map, share} from "rxjs/internal/operators";
import {ExtstatsTable} from "./table-config/extstats-table";

export abstract class DataSourceComponent<T> implements ExtstatsTable, AfterViewInit {
  protected geek: string;
  private selectors = new Subject<string>();
  public data$: Observable<T>;
  protected selector: string;

  protected constructor(private http: HttpClient, defaultSelector: string) {
    this.selector = defaultSelector;
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

  private doQuery(selector: string): Observable<T> {
    const options = {
      headers: new HttpHeaders().set("x-api-key", this.getApiKey())
    };
    const body: GeekGameQuery = {
      query: selector,
      geek: this.geek,
      format: this.getQueryResultFormat(),
      vars: this.getQueryVariables()
    };
    Object.assign(body, this.getExtra());
    return this.http.post("https://api.drfriendless.com/v1/query", body, options) as Observable<T>;
  }

  public getSelector(): string {
    return this.selector;
  }

  public setSelector(s: string) {
    this.selector = s;
    this.selectors.next(s);
  }

  public abstract getId(): string;

  protected abstract getQueryResultFormat(): string;

  protected abstract getQueryVariables(): { [key: string]: string };

  protected abstract getApiKey(): string;

  protected getExtra(): { [key: string]: any } {
    return {};
  }
}
