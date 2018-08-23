import { Component, OnInit } from '@angular/core';
import {ButtonGroupButton} from "./button-group-interfaces";

@Component({
  selector: 'extstats-button-group',
  templateUrl: './button-group.component.html'
})
export class ButtonGroupComponent implements OnInit {
  public selected: string;
  private buttons: ButtonGroupButton[] = [];

  constructor() { }

  ngOnInit() {
  }

  public register(button: ButtonGroupButton) {
    this.buttons.push(button);
  }

  public clicked(button: ButtonGroupButton) {
    this.selected = button.getSelector();
    this.buttons.forEach(b => {
      if (b != button) b.deselected();
    })
  }
}
