import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { MultiPlaysWidget } from './app.component';
import { NewPlaysComponent } from './new-plays/new-plays.component';
import { HttpClientModule } from "@angular/common/http";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { ExtstatsAngularModule } from "extstats-angular";
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    MultiPlaysWidget, NewPlaysComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule, FormsModule
  ],
  providers: [],
  bootstrap: [MultiPlaysWidget]
})
export class AppModule { }
