import { Component, AfterViewInit, Input } from '@angular/core';
import {ExtstatsTable} from "./extstats-table";

@Component({
  selector: 'extstats-table-config',
  templateUrl: './table-config.component.html'
})
export class TableConfigComponent implements AfterViewInit {
  @Input() table: ExtstatsTable;

  public selectors = [] as string[];
  public selector = "";

  constructor() { }

  public ngAfterViewInit() {
    const s = this.table.getSelector();
    this.selector = s;
    this.selectors = [ s ];
  }

  public submit() {
    this.table.setSelector(this.selector);
    if (this.selectors.indexOf(this.selector) < 0) this.selectors.push(this.selector);
  }
}
