import { Component } from '@angular/core';
import { PlaysWithDate } from 'extstats-core';
import { PlayIndex } from '../play-index';
import { getParamValueQueryString, ExpandListener, PlaysTableRowModel, SimplePlays, MONTH_NAMES, GameIndex } from '../library';
import { PlayIndexService, PlayAndGamesIndex } from '../play-index.service';

@Component({
  selector: 'all-plays-table',
  templateUrl: './all-plays-table.component.html'
})
export class AllPlaysTableComponent implements ExpandListener {
  private DAYS31 = [];
  private DAYS0 = [ 0 ];
  public rows: PlaysTableRowModel[] = [];
  private expanded: Set<number> = new Set();
  private initialExpanded: Set<number> = new Set();
  private playIndex: PlayIndex;
  private gamesIndex: GameIndex;
  private years: number[];

  constructor(private playIndexService: PlayIndexService) {
  }

  public ngOnInit() {
    for (let d = 1; d <= 31; d++) {
      this.DAYS31.push(d);
    }
    // the URL can specify that some dates are already expanded
    const exs = getParamValueQueryString('expanded');
    if (exs) {
      const exss = exs.split(',').map(s => s.trim()).filter(s => !!s);
      for (const xs of exss) {
        const x = parseInt(xs);
        if (x === 0 || (x > 1900 && x < 3000) || (x > 190000 && x < 300000) || (x > 19000000 && x < 30000000)) {
          this.initialExpanded.add(x);
          if (x > 19000000) {
            this.initialExpanded.add(Math.floor(x / 100));
            this.initialExpanded.add(Math.floor(x / 10000));
          } else if (x > 190000 && x < 300000) {
            this.initialExpanded.add(Math.floor(x / 100));
          }
        }
      }
    }
    this.playIndexService.data$.subscribe(pg => this.processData(pg));
  }

  protected processData(pg: PlayAndGamesIndex) {
    this.expanded.clear();
    this.initialExpanded.forEach(x => this.expanded.add(x));
    this.playIndex = pg.playIndex;
    this.gamesIndex = pg.gamesIndex;
    this.years = pg.years.slice();
    this.years.sort((a, b) => a - b);
    this.refreshTable();
  }

  private refreshTable() {
    const rows = [];
    for (const year of this.years) {
      const row = new PlaysTableRowModel();
      row.year = year;
      row.yearHeader = true;
      row.monthHeader = false;
      row.yearSpan = 1;
      const yearData = this.playIndex.getTotalPlays(year);
      row.yearPlays = yearData.count;
      row.yearDistinct = yearData.distinct;
      row.yearDates = yearData.dates;
      rows.push(row);
      if (this.expanded.has(year)) {
        let first = true;
        let yearSpan = 0;
        const yearMonths = (year === 0) ? [0] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        for (const month of yearMonths) {
          const monthKey = year * 100 + month;
          const monthData = this.playIndex.getTotalPlays(monthKey);
          if (monthData.count > 0) {
            const monthRow = first ? row : new PlaysTableRowModel();
            monthRow.monthHeader = true;
            monthRow.month = MONTH_NAMES[month];
            monthRow.monthPlays = monthData.count;
            monthRow.monthDistinct = monthData.distinct;
            monthRow.monthDates = monthData.dates;
            monthRow.monthKey = monthKey;
            if (monthRow !== row) rows.push(monthRow);
            first = false;
            yearSpan++;
            if (this.expanded.has(monthKey)) {
              let mfirst = true;
              let monthSpan = 0;
              const monthDates = (year === 0) ? this.DAYS0 : this.DAYS31;
              for (const d of monthDates) {
                const dateKey = monthKey * 100 + d;
                const dateData = this.playIndex.getTotalPlays(dateKey);
                if (dateData.count > 0) {
                  const dateRow = mfirst ? monthRow : new PlaysTableRowModel();
                  dateRow.date = d;
                  dateRow.datePlays = dateData.count;
                  dateRow.dateDistinct = dateData.distinct;
                  dateRow.plays = this.playIndex.getPlays(dateKey).map(pwd => this.makeSimplePlays(pwd));
                  dateRow.dateKey = dateKey;
                  dateRow.dateExpanded = this.expanded.has(dateKey);
                  dateRow.dateShown = true;
                  if (dateRow !== monthRow) {
                    rows.push(dateRow);
                    yearSpan++;
                  }
                  mfirst = false;
                  monthSpan++;
                }
              }
              monthRow.monthSpan = monthSpan;
            }
          }
        }
        row.yearSpan = yearSpan;
      } else {
        row.yearSpan = 1;
      }
    }
    this.rows = rows;
  }

  public toggleExpand(cell: number) {
    if (this.expanded.has(cell)) {
      this.expanded.delete(cell);
    } else {
      this.expanded.add(cell);
    }
    this.refreshTable();
  }

  private makeSimplePlays(play: PlaysWithDate): SimplePlays {
    const result = new SimplePlays();
    result.gameId = play.game;
    result.gameName = this.gamesIndex[play.game].name;
    result.quantity = play.quantity;
    return result;
  }
}

