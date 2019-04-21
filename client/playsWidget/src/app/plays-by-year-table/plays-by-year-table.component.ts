import { Component, OnInit } from '@angular/core';
import { PlayAndGamesIndex, PlayIndexService } from '../play-index.service';
import { buildTooltip } from '../library';

@Component({
  selector: 'plays-by-year-table',
  templateUrl: './plays-by-year-table.component.html'
})
export class PlaysByYearTableComponent implements OnInit {
  public rows: PlaysByYearRow[] = [];

  constructor(private playIndexService: PlayIndexService) {
  }

  public ngOnInit(): void {
    this.playIndexService.data$.subscribe(pg => this.processData(pg));
  }

  protected processData(pg: PlayAndGamesIndex) {
    const rows = [];
    pg.years.forEach(y => {
      const totals = pg.playIndex.getTotalPlays(y);
      const nd = pg.playIndex.getNickelAndDimes(y);
      rows.push({
        year: y, plays: totals.count, distinct: totals.distinct, dates: totals.dates,
        new: totals.new.length, newTooltip: buildTooltip(pg.gamesIndex, totals.new),
        nickel: nd.nickel.length, dime: nd.dime.length, quarter: nd.quarter.length, dollar: nd.dollar.length,
        nickelTooltip: buildTooltip(pg.gamesIndex, nd.nickel), dimeTooltip: buildTooltip(pg.gamesIndex, nd.dime),
        quarterTooltip: buildTooltip(pg.gamesIndex, nd.quarter), dollarTooltip: buildTooltip(pg.gamesIndex, nd.dollar),
      });
    });
    this.rows = rows;
  }
}

class PlaysByYearRow {
  year: number;
  plays: number;
  distinct: number;
  dates: number;
  new: number;
  newTooltip: string;
  nickel: number;
  dime: number;
  quarter: number;
  dollar: number;
  nickelTooltip: string;
  dimeTooltip: string;
  quarterTooltip: string;
  dollarTooltip: string;
}
