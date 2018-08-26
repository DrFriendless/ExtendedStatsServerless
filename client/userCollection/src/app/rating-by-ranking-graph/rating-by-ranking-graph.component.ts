import { Component, OnDestroy, AfterViewInit, Input } from '@angular/core';
import {Collection} from "extstats-core";
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";

@Component({
  selector: 'rating-by-ranking-graph',
  templateUrl: './rating-by-ranking-graph.component.html'
})
export class RatingByRankingGraphComponent implements OnDestroy, AfterViewInit {
  @Input('data') data$: Observable<Collection>;
  private subscription: Subscription;

  constructor() { }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public ngAfterViewInit() {
    this.subscription = this.data$.subscribe(this.processData);
  }

  private processData(collection: Collection) {
  }
}
