import { Component } from '@angular/core';
import { CollectionWithMonthlyPlays } from "extstats-core";
import { DataViewComponent } from "extstats-angular";

@Component({
  selector: 'plays-by-month-ever',
  templateUrl: './plays-by-month-ever.component.html',
  styleUrls: ['./plays-by-month-ever.component.css']
})
export class PlaysByMonthEverComponent extends DataViewComponent<CollectionWithMonthlyPlays> {
  public rows: object[] = [];

  protected processData(collection: CollectionWithMonthlyPlays) {
  }
}
