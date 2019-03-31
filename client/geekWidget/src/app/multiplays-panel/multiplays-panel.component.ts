import { Component, Input } from '@angular/core';
import { GeekSummary } from 'extstats-core';

@Component({
  selector: 'multiplays-panel',
  templateUrl: './multiplays-panel.component.html',
  styleUrls: ['./multiplays-panel.component.css']
})
export class MultiplaysPanelComponent {
  @Input('geekData') data: GeekSummary;

  constructor() { }
}
