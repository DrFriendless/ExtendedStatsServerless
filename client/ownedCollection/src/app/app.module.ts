import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import {HttpClientModule} from "@angular/common/http";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import {ExtstatsAngularModule} from "extstats-angular";
import { FormsModule } from '@angular/forms';
import { UserOwnedComponent } from './app.component';
import { OwnedByPublishedYearComponent } from './owned-by-published-year/owned-by-published-year.component';
import { RatingsOfOwnedGamesComponent } from './ratings-of-owned-games/ratings-of-owned-games.component';

@NgModule({
  declarations: [
    UserOwnedComponent,
    OwnedByPublishedYearComponent,
    RatingsOfOwnedGamesComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule, FormsModule
  ],
  providers: [],
  bootstrap: [UserOwnedComponent]
})
export class AppModule { }
