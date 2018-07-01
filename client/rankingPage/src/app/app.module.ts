import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import {RankingTableComponent} from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "angular-6-datatable";

@NgModule({
  declarations: [
    RankingTableComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule
  ],
  providers: [],
  bootstrap: [RankingTableComponent]
})
export class AppModule { }
