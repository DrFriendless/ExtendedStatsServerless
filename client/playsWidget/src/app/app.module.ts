import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { PlaysWidget } from './app.component';
import { NewPlaysComponent } from './new-plays/new-plays.component';
import { HttpClientModule } from "@angular/common/http";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { ExtstatsAngularModule } from "extstats-angular";
import { FormsModule } from '@angular/forms';
import { AllPlaysTableComponent } from './all-plays-table/all-plays-table.component';
import { PlaysTableRowComponent } from './plays-table-row/plays-table-row.component';
import { PlaysByMonthTableComponent } from './plays-by-month-table/plays-by-month-table.component';
import { PlaysByYearTableComponent } from './plays-by-year-table/plays-by-year-table.component';
import { PlaysByWeekGraphComponent } from './plays-by-week-graph/plays-by-week-graph.component';
import { DataTableModule } from "extstats-datatable";

@NgModule({
  declarations: [
    PlaysWidget,
    NewPlaysComponent,
    AllPlaysTableComponent,
    PlaysTableRowComponent,
    PlaysByMonthTableComponent,
    PlaysByYearTableComponent,
    PlaysByWeekGraphComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule, FormsModule, DataTableModule
  ],
  providers: [],
  bootstrap: [PlaysWidget]
})
export class AppModule { }
