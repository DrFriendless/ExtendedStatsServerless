import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { GeekSummary, fromExtStatsStorage } from "extstats-core";
import {Subscription} from "rxjs/internal/Subscription";
import {HttpClient, HttpHeaders} from "@angular/common/http";

@Component({
  selector: 'extstats-geek',
  templateUrl: './app.component.html'
})
export class GeekWidget implements AfterViewInit, OnDestroy {
  private loadData$;
  public data: GeekSummary;
  private subscription: Subscription;
  private geek: string;

  public constructor(private http: HttpClient) {
  }

  public ngAfterViewInit() {
    this.geek = fromExtStatsStorage(storage => storage.geek);
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    const body = {};
    this.loadData$ = this.http.post("https://api.drfriendless.com/v1/summary?geek=" + encodeURIComponent(this.geek), body, options);
    this.subscription = this.loadData$.subscribe(result => {
      this.data = result;
      console.log(this.data);
    });
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
