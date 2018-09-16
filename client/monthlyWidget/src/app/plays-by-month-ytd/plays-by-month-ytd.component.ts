import { Component, OnInit } from '@angular/core';
import { DataViewComponent } from "extstats-angular";
import { CollectionWithMonthlyPlays, MonthlyPlays, makeGamesIndex } from "extstats-core";

@Component({
  selector: 'plays-by-month-ytd',
  templateUrl: './plays-by-month-ytd.component.html',
  styleUrls: ['./plays-by-month-ytd.component.css']
})
export class PlaysByMonthYtdComponent extends DataViewComponent<CollectionWithMonthlyPlays> {
  public columns = [
    { field: "month", name: "Month", tooltip: "The month this row is for." },
    { field: "plays", name: "Plays", tooltip: "How many games you played in this month." },
    { field: "distinct", name: "Distinct Games", tooltip: "Different games played this month.",
      valueTooltip: (r: Row) => r.gamesPlayedNames.join(", ") },
    { field: "expansions", name: "Expansions", tooltip: "Different expansions played this month.",
      valueTooltip: (r: Row) => r.expansionNames.join(", ") },
    { field: "newGames", name: "New Games", tooltip: "Games played for the first time ever.",
      valueTooltip: (r: Row) => r.newGameNames.join(", ") },
    { field: "newNickels", name: "New Nickels", tooltip: "Games played 5 times this year due to plays in this month.",
      valueTooltip: (r: Row) => r.newNickelNames.join(", ") },
    { field: "newDimes", name: "New Dimes", tooltip: "Games played 10 times this yer due to plays in this month.",
      valueTooltip: (r: Row) => r.newDimeNames.join(", ") },
    { field: "playsYtd", name: "Plays YTD", tooltip: "Total plays so far this year, at the end of the month." },
    { field: "distinctYtd", name: "Distinct YTD", tooltip: "Total different games so far this year, at the end of the month." },
    { field: "hindex", name: "H-Index", tooltip: "You had played this many games this many times each at the end of this month." }
  ].map(c => new Column(c));
  public rows: Row[] = [];

  protected processData(collection: CollectionWithMonthlyPlays) {
    const gamesIndex = makeGamesIndex(collection.games);
    const byMonth = {} as { [month: string]: MonthlyPlays[] };
    const allGameIds = [];
    for (let mp of collection.plays) {
      const key = PlaysByMonthYtdComponent.makeKey(mp.year, mp.month);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(mp);
      allGameIds.push(mp.game);
    }
    const rows = [];
    for (let key in byMonth) {
      const mps = byMonth[key];
      const distinct = mps.filter(mp => !mp.expansion).length;
      const expansions = mps.filter(mp => mp.expansion).length;
      const mp = mps[0];
      const plays = PlaysByMonthYtdComponent.sum(mps.filter(mp => !mp.expansion).map(mp => mp.quantity));
      const sortOrder = mp.year * 12 + mp.month;
      const row = { month: key, distinct, expansions, plays, sortOrder, newGames: 0, newNickels: 0, newDimes: 0,
        year: mp.year, playsYtd: 0, distinctYtd: 0, january: mp.month === 0, expansionNames: [],
        gamesPlayedNames: [], newDimeNames: [], newGameNames: [], newNickelNames: [], hindex: 0 } as Row;
      rows.push(row);
    }
    rows.sort((r1,r2) => r1.sortOrder - r2.sortOrder);
    let currentYear = -1;
    const playsByGame: { [game: number]: number } = {};
    let playsYtd;
    let distinctYtd;
    const gamesEverPlayed = [];
    rows.forEach(row => {
      if (row.year != currentYear) {
        allGameIds.forEach(game => playsByGame[game] = 0);
        currentYear = row.year;
        playsYtd = 0;
        distinctYtd = 0;
      }
      const pbm = byMonth[row.month];
      pbm.forEach(mp => {
        const gameName = gamesIndex[mp.game].name;
        if (mp.expansion) {
          row.expansionNames.push(gameName);
        } else {
          row.gamesPlayedNames.push(gameName);
        }
        playsYtd += mp.quantity;
        const playsBefore = playsByGame[mp.game];
        if (gamesEverPlayed.indexOf(mp.game) < 0) {
          // a new game
          row.newGames++;
          row.newGameNames.push(gameName);
          gamesEverPlayed.push(mp.game);
        }
        if (playsBefore === 0) {
          distinctYtd++;
        }
        const playsAfter = playsBefore + mp.quantity;
        if (playsBefore < 5 && playsAfter >= 5) {
          row.newNickels++;
          row.newNickelNames.push(gameName);
        }
        if (playsBefore < 10 && playsAfter >= 10) {
          row.newDimes++;
          row.newDimeNames.push(gameName);
        }
        playsByGame[mp.game] = playsAfter;
      });
      row.playsYtd = playsYtd;
      row.distinctYtd = distinctYtd;
      row.hindex = PlaysByMonthYtdComponent.calcHIndex(Object.values(playsByGame));
    });
    rows.sort((r1,r2) => r2.sortOrder - r1.sortOrder);
    this.rows = rows;
  }

  private static calcHIndex(values: number[]) {
    values.sort((a,b) => b-a);
    let hindex = 0;
    while (hindex < values.length && values[hindex] > hindex) hindex++;
    return hindex;
  }

  private static makeKey(year: number, month: number): string {
    if (month >= 10) return "" + year + "-" + month;
    return "" + year + "-0" + month;
  }

  private static sum(nums: number[]): number {
    return nums.reduce(function(a, b) { return a + b; }, 0);
  }
}

interface Row {
  month: string;
  distinct: number;
  plays: number;
  sortOrder: number;
  january: boolean;
  year: number;
  expansionNames: string[];
  gamesPlayedNames: string[];
  newGameNames: string[];
  newNickelNames: string[];
  newDimeNames: string[];
  hindex: number;
}

class Column<R extends object> {
  name: string;
  field: string;
  tooltip: string;
  valueHtml(r:R): string { return r[this.field] };
  valueTooltip(r: R): string | undefined { return undefined };

  constructor(obj: object) {
    if (obj["name"]) this.name = obj["name"];
    if (obj["field"]) this.field = obj["field"];
    if (obj["tooltip"]) this.tooltip = obj["tooltip"];
    if (obj["valueHtml"]) this.valueHtml = obj["valueHtml"];
    if (obj["valueTooltip"]) this.valueTooltip = obj["valueTooltip"];
  }
}
