import { Component, OnInit } from '@angular/core';
import {ButtonGroupButton} from "./button-group-interfaces";

@Component({
  selector: 'extstats-button-group',
  templateUrl: './button-group.component.html'
})
export class ButtonGroupComponent {
  public selected: string;
  private buttons: ButtonGroupButton[] = [];

  public register(button: ButtonGroupButton) {
    this.buttons.push(button);
  }

  public clicked(button: ButtonGroupButton) {
    if (button.getSelector() === this.selected) {
      this.selected = null;
    } else {
      this.selected = button.getSelector();
      this.buttons.forEach(b => {
        if (b != button) b.deselected();
      });
    }
  }
}
