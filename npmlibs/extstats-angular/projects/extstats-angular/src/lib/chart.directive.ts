import {CollectionWithPlays} from "extstats-core";
import {AfterViewInit, Directive, ElementRef, HostListener, Input} from '@angular/core';
import {ChartDefinition} from "./charts";
import {ChartPaneComponent} from "./chart-pane/chart-pane.component";
import {VisualizationSpec, vega} from "vega-embed";
import embed from "vega-embed";

@Directive({
  selector: '[extstatsChart]'
})
// Attach a chart definition to a button so that when the button is clicked, the chart appears.
export class ChartDirective implements AfterViewInit {
  @Input('extstatsChart') definition: ChartDefinition;
  @Input('chartData') data: CollectionWithPlays;
  @Input('chartPane') pane: ChartPaneComponent;
  private button: HTMLElement;

  constructor(private el: ElementRef) {
    this.button = el.nativeElement;
  }

  public ngAfterViewInit() {
    this.button.textContent = this.definition.name;
  }

  @HostListener('click') onClick() {
    const chartData = this.definition.extractData(this.data) as { name: string };
    const spec = this.definition.makeSpec(chartData);
    embed(this.pane.getTarget(), spec, { actions: true });
    this.pane.show();
  }
}
