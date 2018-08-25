import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import {FavouritesComponent} from './app.component';
import {HttpClientModule} from "@angular/common/http";
import {DataTableModule} from "extstats-datatable";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import {ExtstatsAngularModule} from "extstats-angular";
import { ExtstatsDocumentationComponent } from './extstats-documentation/extstats-documentation.component';
import { TableConfigComponent } from './table-config/table-config.component';
import { ButtonGroupComponent } from './button-group/button-group.component';
import { ButtonGroupButtonDirective } from './button-group-button.directive';
import { FormsModule } from '@angular/forms';
import { NguiAutoCompleteModule } from '@ngui/auto-complete';

@NgModule({
  declarations: [
    FavouritesComponent,
    ExtstatsDocumentationComponent,
    TableConfigComponent,
    ButtonGroupComponent,
    ButtonGroupButtonDirective,
  ],
  imports: [
    BrowserModule, HttpClientModule, DataTableModule, TooltipModule.forRoot(), NgbModule.forRoot(), ExtstatsAngularModule,
    NguiAutoCompleteModule, FormsModule
  ],
  providers: [],
  bootstrap: [FavouritesComponent]
})
export class AppModule { }
