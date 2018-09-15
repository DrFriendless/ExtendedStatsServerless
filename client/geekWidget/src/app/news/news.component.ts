import { Component, OnInit, AfterViewInit } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import { NewsItem } from "extstats-core";
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'extstats-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.css']
})
export class NewsComponent implements OnInit, AfterViewInit {
  private loadData$;
  public data: NewsItem[] = [];
  private subscription: Subscription;

  public constructor(private http: HttpClient) { }

  public ngOnInit() {
  }

  public ngAfterViewInit() {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    this.loadData$ = this.http.get("https://api.drfriendless.com/v1/news", options);
    this.subscription = this.loadData$.subscribe(result => {
      console.log(result);
      this.data = result;
    });
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
