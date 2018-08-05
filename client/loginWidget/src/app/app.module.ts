import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { LoginComponent } from './app.component';
import {HttpClientModule} from "@angular/common/http";

@NgModule({
  declarations: [
    LoginComponent
  ],
  imports: [
    BrowserModule, HttpClientModule
  ],
  providers: [],
  bootstrap: [LoginComponent]
})
export class AppModule { }
