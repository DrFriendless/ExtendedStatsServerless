import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";
import { Input, OnDestroy, AfterViewInit } from '@angular/core';

export abstract class DataViewComponent<D> implements OnDestroy, AfterViewInit {
  @Input('data') data$: Observable<D>;
  private dataSubscription: Subscription;

  public ngOnDestroy() {
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
  }

  public ngAfterViewInit() {
    this.dataSubscription = this.data$.subscribe(collection => this.processData(collection));
  }

  protected abstract processData(data: D);
}
