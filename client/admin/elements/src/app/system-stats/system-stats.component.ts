import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  ViewEncapsulation
} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {SystemStats, TypeCount} from '../admin-interfaces';
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'extstats-system-stats',
  templateUrl: "./system-stats.component.html",
  styleUrls: ["./system-stats.component.css"],
  encapsulation: ViewEncapsulation.Native,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SystemStatsComponent implements AfterViewInit, OnDestroy {
  public stats = {} as SystemStats;
  private subscription: Subscription = null;

  constructor(private http: HttpClient, private changeDetector: ChangeDetectorRef) { }

  public ngAfterViewInit(): void {
    const headers = new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ");
    this.subscription = this.http.get("https://api.drfriendless.com/v1/systemStats", {headers})
      .subscribe(value => {
        console.log(value);
        this.stats = value as SystemStats;
        this.changeDetector.detectChanges();
      });
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
