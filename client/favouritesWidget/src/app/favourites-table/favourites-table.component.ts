import { Component, OnInit } from '@angular/core';
import {CollectionWithPlays, GameData, GamePlays } from "extstats-core";
import { ExtstatsTable, DataViewComponent, ChartSet, ChartDefinition } from "extstats-angular";
import {VisualizationSpec, vega} from "vega-embed";

@Component({
  selector: 'favourites-table',
  templateUrl: './favourites-table.component.html',
  styleUrls: ['./favourites-table.component.css']
})
export class FavouritesTableComponent extends DataViewComponent<CollectionWithPlays> implements OnInit {
  public columns = [
    {field: "gameName", name: "Game"},
    {field: "rating", name: "Rating", tooltip: "Your rating for this game."},
    {field: "plays", name: "Plays", tooltip: "The number of times you have played this game."},
    {field: "bggRanking", name: "BGG Ranking", tooltip: "This game's ranking on BoardGameGeek."},
    {field: "bggRating", name: "BGG Rating", tooltip: "This game's rating on BoardGameGeek."},
    {field: "firstPlayed", name: "First Play", tooltip: "First date you played this game."},
    {field: "lastPlayed", name: "Last Play", tooltip: "Last date you played this game."},
    {field: "monthsPlayed", name: "Months Played", tooltip: "Number of months in which you have played this game."},
    {field: "hoursPlayed", name: "Hours Played", tooltip: "Hours for which you have played this game."},
    {field: "fhm", name: "Friendless", tooltip: "Friendless Happiness Metric"},
    {field: "hhm", name: "Huber", tooltip: "Huber Happiness Metric"},
    {field: "huberHeat", name: "Huber Heat", tooltip: "Huber Heat"},
    {field: "ruhm", name: "R!UHM", tooltip: "Randy Cox Not Unhappiness Metric"},
    {field: "yearPublished", name: "Published", tooltip: "The year in which this game was first published."}
  ].map(c => new Column(c));
  public rows: Row[] = [];
  public chartSet = new ChartSet();
  public data: CollectionWithPlays;

  public ngOnInit() {
    this.chartSet.add(new ChartDefinition("FHM vs Year Published",
      FavouritesTableComponent.fhmVsYearPublished, FavouritesTableComponent.fhmVsYpSpec));
  }

  private static fhmVsYpSpec(values: object): VisualizationSpec {
    const star = "M0,0.2L0.2351,0.3236 0.1902,0.0618 0.3804,-0.1236 0.1175,-0.1618 0,-0.4 -0.1175,-0.1618 -0.3804,-0.1236 -0.1902,0.0618 -0.2351,0.3236 0,0.2Z";
    return {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "title": "FHM vs Year Published",
      "autosize": {
        "type": "fit",
        "resize": true
      },
      "width": 600,
      "height": 600,
      "data": [ { values, name: "table" } ],
      "scales": [ {
        "name": "x",
        "type": "linear",
        "range": "width",
        "zero": false,
        "domain": {"data": "table", "field": "year"}
      }, {
        "name": "y",
        "type": "linear",
        "range": "height",
        "nice": true, "zero": true,
        "domain": {"data": "table", "field": "fhm"}
      }, {
        "name": "sub",
        "type": "ordinal",
        "domain": ["Abstract Games", "Children's Games", "Customizable Games", "Family Games", "Party Games",
          "Strategy Games", "Thematic Games", "Unknown", "Wargames"],
        "range": ['#000000', '#f0d000', "#A4C639", '#20d0d0', '#f02020', '#4381b2', '#fab6b6', "#888888", '#BDB76B' ]
      }, {
        "name": "shape",
        "type": "ordinal",
        "domain": ["Abstract Games", "Children's Games", "Customizable Games", "Family Games", "Party Games",
          "Strategy Games", "Thematic Games", "Unknown", "Wargames"],
        "range": ['circle', 'square', "cross", 'diamond', 'triangle-up', 'triangle-down', 'triangle-right', "triangle-left", star ]
      }
      ],
      "axes": [
        {"orient": "bottom", "scale": "x", "zindex": 1, "title": "Year Published" },
        {"orient": "left", "scale": "y", "zindex": 1, "title": "Friendless Happiness Metric" }
      ],
      "marks": [{
        "type": "symbol",
        "from": {"data": "table"},
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "year"},
            "y": { "scale": "y", "field": "fhm"},
            "tooltip": {"field": "tooltip", "type": "quantitative"},
            "stroke": { "field": "subdomain", "scale": "sub" },
            "shape": { "field": "subdomain", "scale": "shape" },
            "strokeWidth": {"value": 2}
          }
        }
      }],
      "legends": [{
        "direction": "vertical",
        "stroke": "sub",
        "shape": "shape"
      }]
    };
  }


  protected processData(data: CollectionWithPlays) {
    this.data = data;
    const HUBER_BASELINE = 4.5;
    const collection = data.collection;
    const playsIndex = FavouritesTableComponent.makePlaysIndex(data.plays);
    const gamesIndex = FavouritesTableComponent.makeGamesIndex(data.games);
    const lastYearIndex = FavouritesTableComponent.makePlaysIndex(data.lastYearPlays);
    this.rows = [];
    collection.forEach(gg => {
      if (!gg.rating) gg.rating = undefined;
      const gp = playsIndex[gg.bggid] || {
        plays: 0,
        expansion: false,
        game: gg.bggid,
        distinctMonths: 0,
        distinctYears: 0
      } as GamePlays;
      const ly = lastYearIndex[gg.bggid] || {
        plays: 0,
        expansion: false,
        game: gg.bggid,
        distinctMonths: 0,
        distinctYears: 0
      } as GamePlays;
      const game = gamesIndex[gg.bggid] || {name: "Unknown", bggRanking: 1000000, bggRating: 1.0} as GameData;
      const hoursPlayed = gp.plays * game.playTime / 60;
      const friendlessHappiness = (!gg.rating) ? undefined : Math.floor((gg.rating * 5 + gp.plays + gp.distinctMonths * 4 + hoursPlayed) * 10) / 10;
      const huberHappiness = (!gg.rating) ? undefined : Math.floor((gg.rating - HUBER_BASELINE) * hoursPlayed);
      let huberHeat = undefined;
      if (gp.plays > 0 && gg.rating) {
        const s = 1 + ly.plays / gp.plays;
        const lyHours = ly.plays * game.playTime / 60;
        const lyHappiness = (gg.rating - HUBER_BASELINE) * lyHours;
        huberHeat = s * s * Math.sqrt(ly.plays) * lyHappiness;
        huberHeat = Math.floor(huberHeat * 10) / 10;
      }
      let ruhm = 0;
      if (gp.distinctMonths > 0 && gg.rating && gp.firstPlay && gp.lastPlay) {
        const firstDate = FavouritesTableComponent.intToDate(gp.firstPlay);
        const lastDate = FavouritesTableComponent.intToDate(gp.lastPlay);
        const flash = FavouritesTableComponent.daysBetween(lastDate, firstDate);
        const lag = FavouritesTableComponent.daysBetween(new Date(), lastDate);
        const flmr = flash / lag * gp.distinctMonths * gg.rating;
        const log = (flmr < 1) ? 0 : Math.log(flmr);
        ruhm = Math.round(log * 100) / 100;
      }
      gg["fhm"] = friendlessHappiness;
      gg["hhm"] = huberHappiness;
      gg["hh"] = huberHeat;
      gg["ruhm"] = ruhm;
      const row = {
        gameName: game.name,
        game: gg.bggid,
        rating: gg.rating,
        plays: gp.plays,
        bggRanking: game.bggRanking,
        bggRating: game.bggRating,
        firstPlayed: FavouritesTableComponent.toDateString(gp.firstPlay),
        lastPlayed: FavouritesTableComponent.toDateString(gp.lastPlay),
        monthsPlayed: gp.distinctMonths,
        yearsPlayed: gp.distinctYears,
        yearPublished: game.yearPublished,
        fhm: friendlessHappiness,
        hhm: huberHappiness,
        huberHeat,
        hoursPlayed: Math.floor(hoursPlayed),
        ruhm
      } as Row;
      this.rows.push(row);
    });
  }

  private static intToDate(date: number): Date | undefined {
    if (!date) return undefined;
    const y = Math.floor(date / 10000);
    const m = Math.floor(date / 100) % 100;
    const d = date % 100;
    return new Date(y, m, d);
  }

  // https://stackoverflow.com/questions/2627473/how-to-calculate-the-number-of-days-between-two-dates
  private static daysBetween(date1: Date, date2: Date) {
    // The number of milliseconds in one day
    const ONE_DAY = 1000 * 60 * 60 * 24;
    // Convert both dates to milliseconds
    const date1Ms = date1.getTime();
    const date2Ms = date2.getTime();
    // Calculate the difference in milliseconds
    const difference_ms = Math.abs(date1Ms - date2Ms);
    // Convert back to days and return
    return Math.round(difference_ms / ONE_DAY);
  }

  private static toDateString(date: number): string {
    if (!date) return "";
    const y = Math.floor(date / 10000);
    const m = Math.floor(date / 100) % 100;
    const d = date % 100;
    const mm = (m < 10) ? "0" + m.toString() : m.toString();
    const dd = (d < 10) ? "0" + d.toString() : d.toString();
    return y.toString() + "-" + mm + "-" + dd;
  }

  private static makeGamesIndex(games: GameData[]): object {
    const result = {};
    games.forEach(gd => {
      result[gd.bggid] = gd;
    });
    return result;
  }

  private static makePlaysIndex(plays: GamePlays[]): object {
    const result = {};
    plays.forEach(gp => {
      result[gp.game] = gp;
    });
    return result;
  }

  private static fhmVsYearPublished(data: CollectionWithPlays): object {
    const values = [];
    const gameById = {};
    for (const gd of data.games) {
      gameById[gd.bggid] = gd;
    }
    for (const gg of data.collection) {
      if (gg["fhm"] > 0 && gameById[gg.bggid].yearPublished >= 1990) {
        values.push({year: gameById[gg.bggid].yearPublished, fhm: gg["fhm"],
          tooltip: gameById[gg.bggid].name, subdomain: gameById[gg.bggid].subdomain });
      }
    }
    return values;
  }
}

interface Row {
  gameName: string;
  rating: number;
  plays: number;
  bggRanking: number;
  bggRating: number;
  firstPlayed: string;
  lastPlayed: string;
  monthsPlayed: number;
  hoursPlayed: number;
  fhm: number;
  hhm: number;
  huberHeat: number;
  ruhm: number;
  yearPublished: number;
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
