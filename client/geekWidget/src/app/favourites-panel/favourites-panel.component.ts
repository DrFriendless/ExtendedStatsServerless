import { Component, OnInit, Input } from '@angular/core';
import { GeekSummary } from "extstats-core";

@Component({
  selector: 'favourites-panel',
  templateUrl: './favourites-panel.component.html',
  styleUrls: ['./favourites-panel.component.css']
})
export class FavouritesPanelComponent implements OnInit {
  @Input('geekData') geek: GeekSummary;

  public constructor() { }

  public ngOnInit() {
  }

}
