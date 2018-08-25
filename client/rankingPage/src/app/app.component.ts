import {
  AfterViewInit,
  Component, OnDestroy, ViewEncapsulation,
} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Subscription} from "rxjs/internal/Subscription";
import {RankingTableRow} from "extstats-core";

@Component({
  selector: 'ranking-table',
  templateUrl: "./app.component.html",
  encapsulation: ViewEncapsulation.None
})
export class RankingTableComponent implements OnDestroy, AfterViewInit {
  private loadData$;
  public rows: RankingTableRow[] = [];
  private subscription: Subscription;

  constructor(private http: HttpClient) {}

  public ngAfterViewInit() {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    const body = {};
    this.loadData$ = this.http.post("https://api.drfriendless.com/v1/rankings", body, options);
    this.subscription = this.loadData$.subscribe(result => {
      this.rows = result;
      console.log(this.rows);
    })
  }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
