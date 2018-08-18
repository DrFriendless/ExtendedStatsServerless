import {Component, OnDestroy} from '@angular/core';
import { Auth0Lock } from 'auth0-lock';
import {Subject} from "rxjs/internal/Subject";
import {Subscription} from "rxjs/internal/Subscription";
import {Observable} from "rxjs/internal/Observable";
import {flatMap} from "rxjs/operators";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Identity, UserData} from "extstats-core";

@Component({
  selector: 'extstats-login',
  templateUrl: './app.component.html'
})
export class LoginComponent implements OnDestroy {
  public showLogin = true;
  public showLogout = false;
  public username: string;
  private logins = new Subject<Identity>();
  private logins$ = this.logins.asObservable();
  private userdata = new Subject<UserData>();
  private readonly loginSubscription: Subscription;
  private readonly userDataSubscription: Subscription;
  private authOptions = {
    auth: {
      responseType: 'token id_token',
      scope: 'openid',
      redirect: false
    },
    autoclose: true,
    oidcConformant: true,
    popupOptions: { width: 300, height: 400 },
    usernameStyle: 'username'
  };

  public lock = new Auth0Lock(
    'z7FL2jZnXI9C66WcmCMC7V1STnQbFuQl',
    'drfriendless.au.auth0.com',
    this.authOptions
  );

  public constructor(private http: HttpClient) {
    this.username = localStorage.getItem("username");
    const logins = this.logins;
    this.lock.on("authenticated", authResult => {
      console.log("authenticated");
      console.log(authResult);
      localStorage.setItem('accessToken', authResult.accessToken);
      localStorage.setItem('identity', JSON.stringify(authResult.idTokenPayload));
      logins.next({ jwt: authResult.idToken } as Identity);
    });
    this.loginSubscription = this.logins$
      .pipe(flatMap((identity: Identity) => {
        localStorage.setItem("jwt", identity.jwt);
        return this.loadUserData();
      }))
      .subscribe((userData: UserData) => {
        this.userdata.next(userData);
      });
    this.userDataSubscription = this.userdata.asObservable().subscribe(userData => {
      if (userData) {
        localStorage.setItem("username", userData.username);
        console.log("Welcome " + userData.username);
        this.username = userData.username;
      } else {
        console.log("Logged out");
      }
    });
  }

  private loadUserData(): Observable<UserData> {
    const jwt = localStorage.getItem("jwt");
    const options = {
        headers: new HttpHeaders().set("Authorization", "Bearer " + jwt)
    };
    return this.http.get("https://api.drfriendless.com/v1/authenticate", options) as Observable<UserData>;
  }

  public ngOnDestroy(): void {
    if (this.loginSubscription) this.loginSubscription.unsubscribe();
    if (this.userDataSubscription) this.userDataSubscription.unsubscribe();
  }

  public login() {
    this.lock.show();
  }

  public logout() {
    localStorage.removeItem("username");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("identity");
    localStorage.removeItem("jwt");
    this.username = undefined;
  }
}


