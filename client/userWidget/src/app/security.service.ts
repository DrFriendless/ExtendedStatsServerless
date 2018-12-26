import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { PersonalData, UserConfig, BuddySet } from 'extstats-core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs/internal/observable/of';

@Injectable({
  providedIn: 'root'
})
export class SecurityService implements SecurityApi {

  constructor(private http: HttpClient) { }

  public loadUserData(): Observable<PersonalData | undefined> {
    const jwt = localStorage.getItem('jwt');
    if (jwt) {
      const options = {
        headers: new HttpHeaders().set('Authorization', 'Bearer ' + jwt)
      };
      console.log('loading personal data for ' + jwt);
      return this.http.get('https://api.drfriendless.com/v1/personal', options) as Observable<PersonalData>;
    } else {
      return of(undefined);
    }
  }

  public getStoredUsername(): string | undefined {
    return localStorage.getItem('username');
  }

  public saveUserConfig(userConfig: UserConfig) {
    const jwt = localStorage.getItem('jwt');
    if (jwt) {
      const options = {
        headers: new HttpHeaders().set('Authorization', 'Bearer ' + jwt)
      };
      const body = userConfig;
      this.http.post('https://api.drfriendless.com/v1/update', body, options);
    }
  }
}

export interface SecurityApi {
  loadUserData(): Observable<PersonalData | undefined>;

  getStoredUsername(): string | undefined;

  saveUserConfig(userConfig: UserConfig);
}

export class TestSecurityService implements SecurityApi {
  private GEEK = 'Friendless';
  private userConfig = { usernames: [this.GEEK], buddies: [ new BuddySet("Family", ["Friendless", "Scrabblette", "harley22"]) ] } as UserConfig;

  public getStoredUsername(): string | undefined {
    return this.GEEK;
  }

  public loadUserData(): Observable<PersonalData | undefined> {
    return of({ error: 'TokenExpiredError', userData: { config: this.userConfig }, allData: undefined } as PersonalData);
  }

  public saveUserConfig(userConfig: UserConfig) {
    this.userConfig = userConfig;
    console.log(userConfig);
  }
}
