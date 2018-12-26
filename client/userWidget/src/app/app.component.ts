import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs/internal/Subject';
import { flatMap, map, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs/internal/Subscription';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SecurityService } from './security.service';
import { UserData, BuddySet } from 'extstats-core';

@Component({
  selector: 'extstats-user-config',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class UserConfigComponent implements OnDestroy {
  private usernames = new Subject<string>();
  private readonly usernameSubscription: Subscription;
  public username: string;
  public buddyGroups: BuddySet[] = [];
  public personalData = '';
  public geekids: string[] = [];

  constructor(private http: HttpClient, private securityApi: SecurityService) {
    this.usernameSubscription = this.usernames.asObservable()
      .pipe(
        map(u => u ? u : undefined),
        tap(u => this.username = u),
        flatMap(u => this.securityApi.loadUserData()),
        tap(pd => this.setToUi(pd.userData)),
        map(pd => pd ? JSON.stringify(pd) : '')
      )
      .subscribe(pds => this.personalData = pds);
    this.refresh();
  }

  private setToUi(ud: UserData) {
    this.geekids = ud.usernames;
    this.buddyGroups = ud.buddies;
  }

  private gatherUserData(): UserData {
    return { usernames: this.geekids, buddies: this.buddyGroups } as UserData;
  }

  public save() {
    this.securityApi.saveUserData(this.gatherUserData());
  }

  public more() {
    this.buddyGroups.push(new BuddySet('', []));
  }

  public refresh() {
    this.usernames.next(this.securityApi.getStoredUsername());
  }

  buddiesChanged(event: BuddySet) {
    if (event.getName() === "") this.buddyGroups = this.buddyGroups.filter(bg => bg !== event);
    console.log(this.buddyGroups);
  }

  public ngOnDestroy() {
    if (this.usernameSubscription) {
      this.usernameSubscription.unsubscribe();
    }
  }
}
