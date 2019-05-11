import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FavouritesComponent } from './app.component';
import { HttpClientModule } from "@angular/common/http";
import { DataTableModule } from "extstats-datatable";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { ExtstatsAngularModule } from "extstats-angular";
import { ExtstatsVegaModule } from "extstats-vega";
import { FormsModule } from '@angular/forms';
import { FavouritesTableComponent } from './favourites-table/favourites-table.component';
import { AverageVsRatingComponent } from './average-vs-rating/average-vs-rating.component';
import { RatingVsPlaysComponent } from './rating-vs-plays/rating-vs-plays.component';
import { RatingVsMonthsPlayedComponent } from './rating-vs-months-played/rating-vs-months-played.component';

@NgModule({
  declarations: [
    FavouritesComponent,
    FavouritesTableComponent,
    AverageVsRatingComponent,
    RatingVsPlaysComponent,
    RatingVsMonthsPlayedComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule,
    FormsModule, ExtstatsVegaModule
  ],
  providers: [],
  bootstrap: [FavouritesComponent]
})
export class AppModule { }
