import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { GeekSummary, fromExtStatsStorage } from 'extstats-core';
import { Subscription } from 'rxjs/internal/Subscription';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { UserDataService } from 'extstats-angular';

@Component({
  selector: 'extstats-geek',
  templateUrl: './app.component.html'
})
export class GeekWidget implements AfterViewInit, OnDestroy {
  private loadData$;
  public data: GeekSummary;
  private subscription: Subscription;
  public geek: string;
  public foundGeek: string;
  public loading = true;

  public constructor(private http: HttpClient, private userDataService: UserDataService) {
  }

  public ngAfterViewInit() {
    this.geek = this.userDataService.getAGeek();
    const options = {
      headers: new HttpHeaders().set('x-api-key', 'gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ')
    };
    this.loadData$ = this.http.get('https://api.drfriendless.com/v1/summary?geek=' + encodeURIComponent(this.geek), options);
    this.subscription = this.loadData$.subscribe(result => {
      console.log(result);
      if (result.warData) {
        this.data = result;
      } else {
        this.data = undefined;
      }
      this.loading = false;
    });
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public choose(geek: string) {
    this.foundGeek = geek;
  }
}
