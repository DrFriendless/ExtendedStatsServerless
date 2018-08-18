import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import {FavouritesComponent} from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "extstats-datatable";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import {ExtstatsAngularModule} from "extstats-angular";
import { ExtstatsDocumentationComponent } from './extstats-documentation/extstats-documentation.component';

@NgModule({
  declarations: [
    FavouritesComponent,
    ExtstatsDocumentationComponent,
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule
  ],
  providers: [],
  bootstrap: [FavouritesComponent]
})
export class AppModule { }
