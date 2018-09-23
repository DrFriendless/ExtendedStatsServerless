import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import {FavouritesComponent} from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "extstats-datatable";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import {ExtstatsAngularModule} from "extstats-angular";
import { FormsModule } from '@angular/forms';
import { FavouritesTableComponent } from './favourites-table/favourites-table.component';
import { PlaysByPublishedYearComponent } from './plays-by-published-year/plays-by-published-year.component';

@NgModule({
  declarations: [
    FavouritesComponent,
    FavouritesTableComponent,
    PlaysByPublishedYearComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule, FormsModule
  ],
  providers: [],
  bootstrap: [FavouritesComponent]
})
export class AppModule { }
