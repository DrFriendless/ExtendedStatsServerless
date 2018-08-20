import { Component, OnInit, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";

@Component({
  selector: 'detailed-plays-panel',
  templateUrl: './detailed-plays-panel.component.html',
  styleUrls: ['./detailed-plays-panel.component.css']
})
export class DetailedPlaysPanelComponent implements OnInit {
  @Input('geekData') geek: GeekSummary;

  constructor() { }

  public ngOnInit() {
  }
}

