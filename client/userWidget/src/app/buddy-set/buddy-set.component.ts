import { Component, Input, OnChanges, ViewChild, Output, EventEmitter } from '@angular/core';
import { BuddySet } from 'extstats-core';
import { GeekChipsComponent } from 'extstats-angular';

@Component({
  selector: 'buddy-set-editor',
  templateUrl: './buddy-set.component.html',
  styleUrls: ['./buddy-set.component.css']
})
export class BuddySetComponent implements OnChanges {
  @ViewChild('chips') chips: GeekChipsComponent;
  @Input('buddies') buddies: BuddySet;
  @Output('edited') change = new EventEmitter<BuddySet>();
  public name: string;
  public geeks: string[];
  public editing = false;

  constructor() { }

  ngOnChanges() {
    this.name = this.buddies.getName();
    this.geeks = this.buddies.getBuddies().slice();
    this.editing = this.name.length == 0;
  }

  edit() {
    this.editing = true;
  }

  save() {
    this.geeks = this.chips.geeks;
    this.buddies.setName(this.name);
    this.buddies.setBuddies(this.geeks);
    this.editing = false;
    console.log(this.buddies);
    this.change.next(this.buddies);
  }

  cancel() {
    this.editing = false;
    this.change.next(this.buddies);
  }

  saveable(): boolean {
    return this.name.length > 0;
  }

  delete() {
    this.buddies.setName("");
    this.change.next(this.buddies);
  }

  value(): BuddySet {
    return new BuddySet(this.name, this.geeks);
  }
}
