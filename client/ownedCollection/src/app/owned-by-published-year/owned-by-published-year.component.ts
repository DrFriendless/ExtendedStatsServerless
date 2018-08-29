import { Component, OnInit, Input, AfterViewInit, OnDestroy } from '@angular/core';
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";
import { Collection, GameData } from "extstats-core";

@Component({
  selector: 'owned-by-year-graph',
  templateUrl: './owned-by-published-year.component.html'
})
export class OwnedByPublishedYearComponent implements OnInit, AfterViewInit, OnDestroy {
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
