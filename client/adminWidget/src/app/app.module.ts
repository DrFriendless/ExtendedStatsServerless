import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import {ExtStatsAdminComponent} from './app.component';
import {HttpClientModule} from "@angular/common/http";

@NgModule({
  declarations: [ ExtStatsAdminComponent ],
  imports: [BrowserModule, HttpClientModule],
  providers: [],
  bootstrap: [ExtStatsAdminComponent]
})
export class AppModule { }
