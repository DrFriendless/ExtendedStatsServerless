import {Component, OnDestroy} from '@angular/core';
import {Subject} from "rxjs/internal/Subject";
import {flatMap, map, tap} from "rxjs/operators";
import {Subscription} from "rxjs/internal/Subscription";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Observable} from "rxjs/internal/Observable";
import {PersonalData} from "extstats-core";
import {of} from "rxjs/internal/observable/of";

@Component({
  selector: 'extstats-user-config',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class UserConfigComponent implements OnDestroy {
  private usernames = new Subject<string>();
  private usernameSubscription: Subscription;
  public username: string;
  public personalData: string = "";
  public geekname: string;

  constructor(private http: HttpClient) {
    this.usernameSubscription = this.usernames.asObservable()
      .pipe(
        map(u => u ? u : undefined),
        tap(u => this.username = u),
        flatMap(u => this.loadUserData()),
        map(pd => pd ? JSON.stringify(pd) : "")
      )
      .subscribe(pds => this.personalData = pds);
    this.refresh();
  }

  private loadUserData(): Observable<PersonalData | undefined> {
    const jwt = localStorage.getItem("jwt");
    if (jwt) {
      const options = {
        headers: new HttpHeaders().set("Authorization", "Bearer " + jwt)
      };
      console.log('loading personal data for ' + jwt);
      return this.http.get("https://api.drfriendless.com/v1/personal", options) as Observable<PersonalData>;
    } else {
      return of(undefined);
    }
  }

  public save() {
    console.log(this.geekname);
  }

  public refresh() {
    this.usernames.next(localStorage.getItem("username"));
  }

  public ngOnDestroy() {
    if (this.usernameSubscription) this.usernameSubscription.unsubscribe();
  }
}
