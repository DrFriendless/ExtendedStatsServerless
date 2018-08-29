import { Component, OnInit, Input, OnDestroy, AfterViewInit } from '@angular/core';
import { Collection, GameData } from "extstats-core";
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'ratings-owned-charts',
  templateUrl: './ratings-of-owned-games.component.html'
})
export class RatingsOfOwnedGamesComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input('data') data$: Observable<Collection>;
  private subscription: Subscription;
  public rows = [];

  constructor() { }

  public ngOnInit() {

  }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public ngAfterViewInit() {
    this.subscription = this.data$.subscribe(collection => this.processData(collection));
  }

  private processData(collection: Collection) {

  }
}
