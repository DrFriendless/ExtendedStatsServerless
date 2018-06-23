import {AfterViewInit, Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {SystemStats, TypeCount} from '../admin-interfaces';
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'extstats-system-stats',
  templateUrl: "./system-stats.component.html",
  styles: [],
  encapsulation: ViewEncapsulation.Native
})
export class SystemStatsComponent implements AfterViewInit, OnDestroy {
  public stats: SystemStats = {
    userRows: 0,
    gameRows: 0,
    geekGamesRows: 0,
    fileRows: [] as [TypeCount],
    waitingFileRows: [] as [TypeCount],
    unprocessedFileRows: [] as [TypeCount]
  };
  private subscription: Subscription = null;
  public clickCount = 0;

  constructor(private http: HttpClient) { }

  public ngAfterViewInit(): void {
    const headers = new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ");
    this.subscription = this.http.get("https://api.drfriendless.com/v1/systemStats", {headers})
      .subscribe(value => {
        console.log(value);
        this.stats = value as SystemStats;
      });
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public click() {
    this.clickCount++;
    console.log(this.clickCount);
  }
}
