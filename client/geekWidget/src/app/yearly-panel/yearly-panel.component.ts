import { Component, OnInit, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";

@Component({
  selector: 'yearly-panel',
  templateUrl: './yearly-panel.component.html',
  styleUrls: ['./yearly-panel.component.css']
})
export class YearlyPanelComponent implements OnInit {
  @Input('geekData') geek: GeekSummary;

  constructor() { }

  public ngOnInit() {
  }
}

