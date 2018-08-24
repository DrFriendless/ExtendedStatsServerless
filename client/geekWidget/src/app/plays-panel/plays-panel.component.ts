import { Component, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";

@Component({
  selector: 'plays-panel',
  templateUrl: './plays-panel.component.html',
  styleUrls: ['./plays-panel.component.css']
})
export class PlaysPanelComponent {
  @Input('geekData') data: GeekSummary;

  constructor() { }
}
