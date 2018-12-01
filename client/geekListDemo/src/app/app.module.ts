import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { GeekComboComponent } from './geek-combo/geek-combo.component';
import { GeekChipsComponent } from './geek-chips/geek-chips.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatInputModule } from "@angular/material";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { GeekListEditorComponent } from './geek-list-editor/geek-list-editor.component';

@NgModule({
  declarations: [
    AppComponent,
    GeekComboComponent,
    GeekChipsComponent,
    GeekListEditorComponent
  ],
  imports: [
    BrowserModule, ReactiveFormsModule, FormsModule, MatFormFieldModule, MatAutocompleteModule, HttpClientModule, MatInputModule,
    BrowserAnimationsModule, MatChipsModule, MatIconModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
