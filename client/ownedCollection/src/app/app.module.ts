import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

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
    BrowserModule
  ],
  providers: [],
  bootstrap: [UserOwnedComponent]
})
export class AppModule { }
