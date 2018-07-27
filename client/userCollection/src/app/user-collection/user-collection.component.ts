import {
  AfterViewInit,
  Component, OnDestroy, ViewEncapsulation,
} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Subscription} from "rxjs/internal/Subscription";
import {GeekGame, GeekGameQuery} from "../collection-interfaces";
import {fromExtStatsStorage} from "../extstats-storage";

@Component({
  selector: 'user-collection',
  templateUrl: "./user-collection.component.html",
  styleUrls: ["./user-collection.component.css"],
  encapsulation: ViewEncapsulation.None
})
export class UserCollectionComponent implements OnDestroy, AfterViewInit {
  private geek: string;
  private loadData$;
  public rows: [GeekGame] = [] as [GeekGame];
  private subscription: Subscription;

  constructor(private http: HttpClient) {
    this.geek = fromExtStatsStorage(storage => storage.geek);
  }

  public ngAfterViewInit(): void {
    if (!this.geek) return;
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    const body: GeekGameQuery = {
      geek: this.geek
    };
    console.log(body);
    this.loadData$ = this.http.post("https://api.drfriendless.com/v1/geekgames", body, options);
    this.subscription = this.loadData$.subscribe(result => {
      this.rows = result;
      console.log(this.rows);
    })
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
