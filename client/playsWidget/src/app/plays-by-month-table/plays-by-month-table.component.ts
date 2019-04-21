import { Component, OnInit } from '@angular/core';
import { PlayAndGamesIndex, PlayIndexService } from '../play-index.service';
import { buildTooltip, MONTH_NAMES } from '../library';

@Component({
  selector: 'plays-by-month-table',
  templateUrl: './plays-by-month-table.component.html'
})
export class PlaysByMonthTableComponent implements OnInit {
  public rows: PlaysByMonthRow[] = [];

  constructor(private playIndexService: PlayIndexService) {
  }

  public ngOnInit(): void {
    this.playIndexService.data$.subscribe(pg => this.processData(pg));
  }

  protected processData(pg: PlayAndGamesIndex) {
    const rows = [];
    pg.playIndex.getMonthKeys().forEach(m => {
      const totals = pg.playIndex.getTotalPlays(m);
      const nd = pg.playIndex.getNickelAndDimes(m);
      const y = Math.floor(m / 100);
      const mo = m % 100;
      rows.push({
        year: y, plays: totals.count, distinct: totals.distinct, dates: totals.dates, month: MONTH_NAMES[mo], key: m,
        new: totals.new.length, newTooltip: buildTooltip(pg.gamesIndex, totals.new),
        nickel: nd.nickel.length, dime: nd.dime.length, quarter: nd.quarter.length, dollar: nd.dollar.length,
        nickelTooltip: buildTooltip(pg.gamesIndex, nd.nickel), dimeTooltip: buildTooltip(pg.gamesIndex, nd.dime),
        quarterTooltip: buildTooltip(pg.gamesIndex, nd.quarter), dollarTooltip: buildTooltip(pg.gamesIndex, nd.dollar),
      });
    });
    this.rows = rows;
  }
}

class PlaysByMonthRow {
  month: string;
  year: number;
  plays: number;
  distinct: number;
  dates: number;
  key: number;
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
