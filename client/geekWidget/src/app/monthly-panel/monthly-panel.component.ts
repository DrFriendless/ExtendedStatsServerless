import { Component, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";

@Component({
  selector: 'monthly-panel',
  templateUrl: './monthly-panel.component.html',
  styleUrls: ['./monthly-panel.component.css']
})
export class MonthlyPanelComponent {
  @Input('geekData') data: GeekSummary;
}

