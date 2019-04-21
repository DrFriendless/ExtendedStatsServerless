import { Component, OnInit } from '@angular/core';
import { PlayAndGamesIndex, PlayIndexService } from '../play-index.service';

@Component({
  selector: 'plays-by-week-graph',
  templateUrl: './plays-by-week-graph.component.html'
})
export class PlaysByWeekGraphComponent implements OnInit {
  constructor(private playIndexService: PlayIndexService) {
  }

  public ngOnInit(): void {
    this.playIndexService.data$.subscribe(pg => this.processData(pg));
  }

  protected processData(pg: PlayAndGamesIndex) {

  }
}
