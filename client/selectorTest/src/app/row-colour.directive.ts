import { Directive, AfterViewInit, Input, ElementRef } from '@angular/core';

@Directive({
  selector: '[extstats-row-colour]'
})
export class RowColourDirective implements AfterViewInit {
  @Input('extstats-row-colour') colour: string | undefined;
  private row: HTMLElement;

  constructor(private el: ElementRef) {
    this.row = el.nativeElement;
  }

  public ngAfterViewInit() {
    if (this.colour) {
      this.row.style.color = this.colour;
    }
  }
}
