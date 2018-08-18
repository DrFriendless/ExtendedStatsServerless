import { NgModule } from '@angular/core';
import {ChartDirective} from "./chart.directive";
import {ChartPaneComponent} from "./chart-pane/chart-pane.component";

@NgModule({
  imports: [
  ],
  declarations: [ChartDirective, ChartPaneComponent],
  exports: [ChartPaneComponent, ChartDirective]
})
export class ExtstatsAngularModule { }
