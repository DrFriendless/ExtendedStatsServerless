import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { GeekWidget } from './app.component';
import { FavouritesPanelComponent } from './favourites-panel/favourites-panel.component';
import { PlaysPanelComponent } from './plays-panel/plays-panel.component';

@NgModule({
  declarations: [
    GeekWidget,
    FavouritesPanelComponent,
    PlaysPanelComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [GeekWidget]
})
export class AppModule { }
