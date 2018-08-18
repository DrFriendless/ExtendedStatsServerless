import {Component, ElementRef, ViewChild} from '@angular/core';

@Component({
  selector: 'extstats-chartpane',
  templateUrl: './chart-pane.component.html',
  styleUrls: ['./chart-pane.component.css']
})
export class ChartPaneComponent {
  @ViewChild('target') target: ElementRef;
  public display: string = "none";

  constructor(private element: ElementRef) {
  }

  public getTarget(): HTMLElement {
    console.log(this.element);
    console.log(this.element.nativeElement.clientWidth);
    console.log(this.element.nativeElement.clientHeight);
    return this.target.nativeElement as HTMLElement;
  }

  public show() {
    this.display = "flex";
  }

  public hide() {
    this.display = "none";
  }
}
