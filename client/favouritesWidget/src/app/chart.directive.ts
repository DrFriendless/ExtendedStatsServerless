// this is only way I could find to import the vega stuff
import {ChartPaneComponent} from "./chart-pane/chart-pane.component";

declare module 'vega-embed' {
  export const config: any;
  export default function embed(e: any, spec: any, ops: any): Promise<any>;
}

import {AfterViewInit, Directive, ElementRef, HostListener, Input} from '@angular/core';
import {ChartDefinition} from "./charts";
import {CollectionWithPlays} from "./collection-interfaces";
import embed from "vega-embed";

@Directive({
  selector: '[extstatsChart]'
})
// Attach a chart definition to a button so that when the button is clicked, the chart appears.
export class ChartDirective implements AfterViewInit {
  @Input('extstatsChart') definition: ChartDefinition;
  @Input('chartData') data: CollectionWithPlays;
  @Input('chartPane') pane: ChartPaneComponent;
  private button: any;

  constructor(private el: ElementRef) {
    this.button = el.nativeElement;
  }

  public ngAfterViewInit() {
    this.button.textContent = this.definition.getName();
  }

  @HostListener('click') onClick() {
    console.log("should show the chart " + this.definition.getName());
    const spec = {
      "$schema": "https://vega.github.io/schema/vega-lite/v2.json",
      "description": this.definition.getName(),
      "autosize": {
        "type": "pad",
        "resize": "true"
      },
      "width": 600,
      "height": 600,
      "data": this.definition.extractData(this.data),
      "mark": this.definition.getMark(),
      "encoding": {
        "x": {"field": "x", "type": "ordinal"},
        "y": {"field": "y", "type": "quantitative"}
      }
    };

    embed(this.pane.getTarget(), spec, { actions: false });
    this.pane.show();
  }
}
