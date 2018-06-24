import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input, OnChanges, OnDestroy, SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {GeekGame, GeekGameQuery} from "../collection-interfaces";
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'extstats-user-collection',
  templateUrl: "./user-collection.component.html",
  styleUrls: ["./user-collection.component.css"],
  encapsulation: ViewEncapsulation.Native,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserCollectionComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() geek: string;
  private loadData$;
  public data: [GeekGame] = [] as [GeekGame];
  private subscription: Subscription;

  constructor(private http: HttpClient, private changeDetectorRef: ChangeDetectorRef) {
  }

  public ngAfterViewInit(): void {
    this.geek = this.geek || 'Friendless';
    this.ngOnChanges(null);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    const body: GeekGameQuery = {
      geek: this.geek
    };
    console.log(body);
    this.loadData$ = this.http.post("https://api.drfriendless.com/v1/geekgames", body, options);
    this.subscription = this.loadData$.subscribe(result => {
      console.log(result);
      this.data = result;
      this.changeDetectorRef.detectChanges();
    })
  }

  public ngOnDestroy(): void {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
