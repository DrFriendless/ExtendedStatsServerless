import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { CollectionWithPlays } from "extstats-core";
import { DataSourceComponent, UserDataService } from "extstats-angular";
import { Subscription } from "rxjs/internal/Subscription";

@Component({
  selector: 'extstats-favourites',
  templateUrl: './app.component.html'
})
export class FavouritesComponent extends DataSourceComponent<CollectionWithPlays> implements OnInit, OnDestroy {
  private static DEFAULT_SELECTOR = "all(played(ME), rated(ME))";
  public INITIAL_SELECTOR = FavouritesComponent.DEFAULT_SELECTOR;
  public data: CollectionWithPlays;
  private dataSubscription: Subscription;

  constructor(http: HttpClient, userDataService: UserDataService) {
    super(http, userDataService, FavouritesComponent.DEFAULT_SELECTOR);
  }

  public ngOnInit(): void {
    super.ngOnInit();
    this.data$.subscribe(collection => this.processData(collection));
  }

  public ngOnDestroy() {
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
  }

  private processData(collection: CollectionWithPlays) {
    console.log("processData");
    console.log(collection);
    this.data = collection;
  }

  public selectorChanged(selector: string) {
    if (selector) super.next(selector);
  }

  protected getQueryResultFormat(): string {
    return "CollectionWithPlays";
  }

  protected getQueryVariables(): { [p: string]: string } {
    return {};
  }

  protected getApiKey(): string {
    return "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ";
  }
}
