import { BrowserModule } from '@angular/platform-browser';
import { NgModule, Injector } from '@angular/core';
import { createCustomElement } from '@angular/elements';

import {AppComponent} from "./app.component";
import {HttpClientModule} from "@angular/common/http";
import {UserCollectionComponent} from "./user-collection/user-collection.component";

@NgModule({
  declarations: [UserCollectionComponent, AppComponent],
  imports: [BrowserModule, HttpClientModule],
  entryComponents: [UserCollectionComponent]
})
export class AppModule {
  constructor(private injector: Injector) {
    const userCollection = createCustomElement(UserCollectionComponent, { injector });
    customElements.define('extstats-user-collection', userCollection);
  }

  ngDoBootstrap() {}
}
