import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { GeekWidget } from './app.component';
import { FavouritesPanelComponent } from './favourites-panel/favourites-panel.component';
import { PlaysPanelComponent } from './plays-panel/plays-panel.component';
import { GamesPanelComponent } from './games-panel/games-panel.component';
import { DetailedPlaysPanelComponent } from './detailed-plays-panel/detailed-plays-panel.component';
import { YearlyPanelComponent } from './yearly-panel/yearly-panel.component';
import { CollectionPanelComponent } from './collection-panel/collection-panel.component';

@NgModule({
  declarations: [
    GeekWidget,
    FavouritesPanelComponent,
    PlaysPanelComponent,
    GamesPanelComponent,
    DetailedPlaysPanelComponent,
    YearlyPanelComponent,
    CollectionPanelComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [GeekWidget]
})
export class AppModule { }
