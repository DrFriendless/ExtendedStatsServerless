import {AfterViewInit, Component, OnDestroy} from "@angular/core";
import {SystemStats} from "./admin-interfaces";
import {Subscription} from "rxjs/internal/Subscription";
import {HttpClient, HttpHeaders} from "@angular/common/http";

@Component({
  selector: 'extstats-admin',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class ExtStatsAdminComponent implements AfterViewInit, OnDestroy {
  public stats = {} as SystemStats;
  private subscription: Subscription = null;

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
}
