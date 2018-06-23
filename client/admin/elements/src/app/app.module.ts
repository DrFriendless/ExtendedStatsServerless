import { BrowserModule } from '@angular/platform-browser';
import { NgModule, Injector } from '@angular/core';
import { createCustomElement } from '@angular/elements';

import { SystemStatsComponent } from './system-stats/system-stats.component';
import {AppComponent} from "./app.component";
import {HttpClientModule} from "@angular/common/http";

@NgModule({
  declarations: [SystemStatsComponent, AppComponent],
  imports: [BrowserModule, HttpClientModule],
  entryComponents: [SystemStatsComponent]
})
export class AppModule {
  constructor(private injector: Injector) {
    const systemStats = createCustomElement(SystemStatsComponent, { injector });
    customElements.define('extstats-system-stats', systemStats);
  }

  ngDoBootstrap() {}
}
