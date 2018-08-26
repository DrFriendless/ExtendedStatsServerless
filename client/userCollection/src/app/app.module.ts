import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import {HttpClientModule} from "@angular/common/http";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import {ExtstatsAngularModule} from "extstats-angular";
import { FormsModule } from '@angular/forms';

import { UserCollectionComponent} from './app.component';
import { FavesByYearTableComponent } from './faves-by-year-table/faves-by-year-table.component';
import { RatingsByYearGraphComponent } from './ratings-by-year-graph/ratings-by-year-graph.component';
import { RatingByRankingGraphComponent } from './rating-by-ranking-graph/rating-by-ranking-graph.component';

@NgModule({
  declarations: [
    UserCollectionComponent,
    FavesByYearTableComponent,
    RatingsByYearGraphComponent,
    RatingByRankingGraphComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule, FormsModule
  ],
  providers: [],
  bootstrap: [UserCollectionComponent]
})
export class AppModule { }
