import { Component, OnInit, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";

@Component({
  selector: 'games-panel',
  templateUrl: './games-panel.component.html',
  styleUrls: ['./games-panel.component.css']
})
export class GamesPanelComponent implements OnInit {
  @Input('geekData') geek: GeekSummary;

  constructor() { }

  public ngOnInit() {
  }
}

