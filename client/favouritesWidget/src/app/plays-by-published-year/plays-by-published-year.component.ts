import { Component, OnInit } from '@angular/core';
import {CollectionWithPlays} from "extstats-core";
import {DataViewComponent} from "extstats-angular";

@Component({
  selector: 'plays-by-published-year',
  templateUrl: './plays-by-published-year.component.html',
  styleUrls: ['./plays-by-published-year.component.css']
})
export class PlaysByPublishedYearComponent extends DataViewComponent<CollectionWithPlays> {
  protected processData(data: CollectionWithPlays) {

  }
}
