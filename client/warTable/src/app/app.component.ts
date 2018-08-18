import {AfterViewInit, Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {Subscription} from "rxjs/internal/Subscription";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {WarTableRow} from "extstats-core";

@Component({
  selector: 'war-table',
  templateUrl: './app.component.html',
  encapsulation: ViewEncapsulation.Emulated
})
export class WarTableComponent implements OnDestroy, AfterViewInit {
  private loadData$;
  public rows: WarTableRow[] = [];
  private subscription: Subscription;
  public docCollapsed = true;

  constructor(private http: HttpClient) {}

  public ngAfterViewInit(): void {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    const body = {};
    this.loadData$ = this.http.post("https://api.drfriendless.com/v1/wartable", body, options);
    this.subscription = this.loadData$.subscribe(result => {
      this.rows = result;
      console.log(this.rows);
    })
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
