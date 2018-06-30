import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { UserCollectionComponent } from './user-collection/user-collection.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "angular-6-datatable";

@NgModule({
  declarations: [
    AppComponent,
    UserCollectionComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule
  ],
  providers: [],
  bootstrap: [UserCollectionComponent]
})
export class AppModule { }
