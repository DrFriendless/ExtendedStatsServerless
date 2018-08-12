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
    const chartData = this.definition.extractData(this.data);
    console.log(chartData);
    const encoding = {
      "x": {
        "field": "x",
        "type": "ordinal",
        "axis": {
          "title": this.definition.getXAxisName()
        }
      },
      "y": {
        "field": "y",
        "type": "quantitative",
        "axis": {
          "title": this.definition.getYAxisName()
        }
      }
    };
    if (chartData["values"].length > 0) {
      const sample = chartData["values"][0];
      console.log(sample);
      if (sample.hasOwnProperty("size")) {
        encoding["size"] = {"field": "size", "type": "quantitative"};
      }
      if (sample.hasOwnProperty("tooltip")) {
        encoding["tooltip"] = {"field": "tooltip", "type": "ordinal"};
      }
    }
    const spec = {
      "$schema": "https://vega.github.io/schema/vega-lite/v2.json",
      "title": this.definition.getName(),
      "autosize": {
        "type": "pad",
        "resize": "true"
      },
      "width": 600,
      "height": 600,
      "data": chartData,
      "mark": this.definition.getMark(),
      "encoding": encoding
    };

    embed(this.pane.getTarget(), spec, { actions: false });
    this.pane.show();
  }
}
