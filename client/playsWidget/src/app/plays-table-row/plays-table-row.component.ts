import { Component, Input } from '@angular/core';
import { ExpandListener, PlaysTableRowModel } from '../library';

@Component({
  selector: '[plays-table-row]',
  templateUrl: './plays-table-row.component.html'
})
export class PlaysTableRowComponent {
  @Input('model') model: PlaysTableRowModel;
  @Input('expandListener') listener: ExpandListener;

  public toggle(cell: number) {
    this.listener.toggleExpand(cell);
  }
}
