import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import {WarTableComponent} from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "angular-6-datatable";

@NgModule({
  declarations: [
    WarTableComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule
  ],
  providers: [],
  bootstrap: [WarTableComponent]
})
export class AppModule { }
