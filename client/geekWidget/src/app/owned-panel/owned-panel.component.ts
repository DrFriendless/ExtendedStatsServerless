import { Component, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";
import { Observer } from "rxjs";

@Component({
  selector: 'owned-panel',
  templateUrl: './owned-panel.component.html',
  styleUrls: ['./owned-panel.component.css']
})
export class OwnedPanelComponent {
  @Input('geekData') data: GeekSummary;
}
