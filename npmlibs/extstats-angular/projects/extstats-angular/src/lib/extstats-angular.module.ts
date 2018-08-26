import { NgModule } from '@angular/core';
import {ChartDirective} from "./chart.directive";
import {ChartPaneComponent} from "./chart-pane/chart-pane.component";
import {DocumentationComponent} from "./extstats-documentation/documentation.component";
import {TableConfigComponent} from "./table-config/table-config.component";
import {ButtonGroupComponent} from "./button-group/button-group.component";
import {ButtonGroupButtonDirective} from "./button-group-button.directive";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import { NguiAutoCompleteModule } from '@ngui/auto-complete';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

@NgModule({
  imports: [
    NgbModule.forRoot(), NguiAutoCompleteModule, FormsModule, BrowserModule
  ],
  declarations: [
    ChartDirective,
    ChartPaneComponent,
    DocumentationComponent,
    TableConfigComponent,
    ButtonGroupComponent,
    ButtonGroupButtonDirective
  ],
  exports: [
    ChartDirective,
    ChartPaneComponent,
    DocumentationComponent,
    TableConfigComponent,
    ButtonGroupComponent,
    ButtonGroupButtonDirective
  ]
})
export class ExtstatsAngularModule { }
