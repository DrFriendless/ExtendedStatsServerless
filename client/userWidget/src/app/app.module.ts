import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { UserConfigComponent } from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {FormsModule} from "@angular/forms";

@NgModule({
  declarations: [
    UserConfigComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, FormsModule
  ],
  providers: [],
  bootstrap: [UserConfigComponent]
})
export class AppModule { }
