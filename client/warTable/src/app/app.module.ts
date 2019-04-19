import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { WarTableComponent } from './app.component';
import { HttpClientModule } from "@angular/common/http";
import { DataTableModule } from "extstats-datatable";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    WarTableComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule, TooltipModule.forRoot(), NgbModule.forRoot()
  ],
  providers: [],
  bootstrap: [WarTableComponent]
})
export class AppModule { }
