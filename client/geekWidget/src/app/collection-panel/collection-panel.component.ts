import { Component, OnInit, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";
import { Observer } from "rxjs";

@Component({
  selector: 'collection-panel',
  templateUrl: './collection-panel.component.html',
  styleUrls: ['./collection-panel.component.css']
})
export class CollectionPanelComponent implements OnInit {
  @Input('geekData') data: GeekSummary;

  constructor() { }

  public ngOnInit() {
  }
}

