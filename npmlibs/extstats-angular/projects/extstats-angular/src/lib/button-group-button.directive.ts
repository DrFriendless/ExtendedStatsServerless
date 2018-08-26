import { Directive, Input, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import {ButtonGroupComponent} from "./button-group/button-group.component";
import {ButtonGroupButton} from "./button-group/button-group-interfaces";

@Directive({
  selector: '[extstatsButtonGroup]'
})
export class ButtonGroupButtonDirective implements AfterViewInit, ButtonGroupButton {
  @Input('extstatsButtonGroup') group: ButtonGroupComponent;
  @Input('selector') selector: string;
  private button: HTMLElement;

  constructor(private el: ElementRef) {
    this.button = el.nativeElement;
  }

  public ngAfterViewInit() {
    this.group.register(this);
  }

  // button group tells us we have been deselected
  public deselected() {
  }

  // tell the button group what our individual identity is
  public getSelector(): string {
    return this.selector;
  }

  // tell the button group we got clicked
  @HostListener('click') onClick() {
    this.group.clicked(this);
  }
}
