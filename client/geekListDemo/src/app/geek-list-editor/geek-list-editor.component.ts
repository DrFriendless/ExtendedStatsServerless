import { Component, OnInit, ViewChild } from '@angular/core';
import {GeekChipsComponent} from '../geek-chips/geek-chips.component';

@Component({
  selector: 'geek-list-editor',
  templateUrl: './geek-list-editor.component.html',
  styleUrls: ['./geek-list-editor.component.css']
})
export class GeekListEditorComponent {
    @ViewChild(GeekChipsComponent) chips;

    public getGeeks(): string[] {
      return this.chips.geeks;
    }
}
