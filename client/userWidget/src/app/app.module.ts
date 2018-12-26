import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { UserConfigComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BuddySetComponent } from './buddy-set/buddy-set.component';
import { ExtstatsAngularModule } from "extstats-angular";
import { FlexLayoutModule } from "@angular/flex-layout"
import {
  MatAutocompleteModule,
  MatBadgeModule,
  MatBottomSheetModule,
  MatButtonModule,
  MatButtonToggleModule,
  MatCardModule,
  MatCheckboxModule,
  MatChipsModule,
  MatDatepickerModule,
  MatDialogModule,
  MatDividerModule,
  MatExpansionModule,
  MatGridListModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatMenuModule,
  MatNativeDateModule,
  MatPaginatorModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatRadioModule,
  MatRippleModule,
  MatSelectModule,
  MatSidenavModule,
  MatSliderModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatSortModule,
  MatStepperModule,
  MatTableModule,
  MatTabsModule,
  MatToolbarModule,
  MatTooltipModule,
  MatTreeModule,
} from '@angular/material';

@NgModule({
  declarations: [
    UserConfigComponent,
    BuddySetComponent
  ],
  imports: [
    BrowserModule, HttpClientModule, FormsModule, ExtstatsAngularModule, MatInputModule, BrowserAnimationsModule, MatButtonModule,
    FlexLayoutModule
  ],
  providers: [],
  bootstrap: [UserConfigComponent]
})
export class AppModule { }
