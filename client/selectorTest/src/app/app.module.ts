import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { SelectorTestComponent } from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "extstats-datatable";
import {TooltipModule} from "ngx-bootstrap";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import {FormsModule} from "@angular/forms";
import { RowColourDirective } from './row-colour.directive';

@NgModule({
  declarations: [
    SelectorTestComponent,
    RowColourDirective
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule, TooltipModule.forRoot(), NgbModule.forRoot(), FormsModule
  ],
  providers: [],
  bootstrap: [SelectorTestComponent]
})
export class AppModule { }
