import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import {FavouritesComponent} from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "extstats-datatable";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';

@NgModule({
  declarations: [
    FavouritesComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule, TooltipModule.forRoot(), NgbModule.forRoot()
  ],
  providers: [],
  bootstrap: [FavouritesComponent]
})
export class AppModule { }
