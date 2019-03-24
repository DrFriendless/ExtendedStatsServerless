import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { PlaysWidget } from './app.component';
import { NewPlaysComponent } from './new-plays/new-plays.component';
import { HttpClientModule } from "@angular/common/http";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { ExtstatsAngularModule } from "extstats-angular";
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    PlaysWidget,
    NewPlaysComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule, FormsModule,
    RouterModule.forRoot([])
  ],
  providers: [],
  bootstrap: [PlaysWidget]
})
export class AppModule { }
