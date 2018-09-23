import { Component, OnInit, OnDestroy } from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Subscription} from "rxjs/internal/Subscription";
import {Subject} from "rxjs/internal/Subject";
import {Observable} from "rxjs/internal/Observable";
import {flatMap, tap, map} from "rxjs/internal/operators";
import {CollectionWithPlays, FavouritesRow, fromExtStatsStorage, GeekGameQuery, GameData, GamePlays} from "extstats-core";
import {ChartSet, ChartDefinition, DocumentationContent, ExtstatsTable, DataSourceComponent} from "extstats-angular";
import {VisualizationSpec, vega} from "vega-embed";

@Component({
  selector: 'extstats-favourites',
  templateUrl: './app.component.html'
})
export class FavouritesComponent extends DataSourceComponent<CollectionWithPlays> implements OnInit, OnDestroy {
  private static DEFAULT_SELECTOR = "all(played(ME), rated(ME))";
  public chartSet = new ChartSet();
  private dataSubscription: Subscription;
  public data: CollectionWithPlays;

  constructor(http: HttpClient) {
    super(http, FavouritesComponent.DEFAULT_SELECTOR);
    this.chartSet.add(new ChartDefinition("Average vs Rating",
      FavouritesComponent.extractAvgVsRating, FavouritesComponent.avrSpec));
    this.chartSet.add(new ChartDefinition("Rating vs Plays",
      FavouritesComponent.extractRatingVsPlays, FavouritesComponent.ratingsVsPlays));
    this.chartSet.add(new ChartDefinition("Rating vs Months Played",
      FavouritesComponent.extractRatingVsMonths, FavouritesComponent.ratingsVsMonths));
  }

  private static ratingsVsMonths(values: object): VisualizationSpec {
    const star = "M0,0.2L0.2351,0.3236 0.1902,0.0618 0.3804,-0.1236 0.1175,-0.1618 0,-0.4 -0.1175,-0.1618 -0.3804,-0.1236 -0.1902,0.0618 -0.2351,0.3236 0,0.2Z";
    return {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "title": "Rating vs Months Played",
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
          "domain": [0, 10]
        }, {
          "name": "y",
          "type": "linear",
          "range": "height",
          "nice": true, "zero": true,
          "domain": {"data": "table", "field": "months"}
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
        {"orient": "bottom", "scale": "x", "zindex": 1, "title": "Your Rating" },
        {"orient": "left", "scale": "y", "zindex": 1, "title": "Number of months in which you have played this game" }
      ],
      "marks": [{
        "type": "symbol",
        "from": {"data": "table"},
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "rating"},
            "y": { "scale": "y", "field": "months"},
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

  private static ratingsVsPlays(values: object): VisualizationSpec {
    return {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "title": "Rating vs Plays",
      "autosize": {
        "type": "fit",
        "resize": true
      },
      "width": 600,
      "height": 600,
      "data": [ { values, name: "table" } ],
      "scales": [
        {
          "name": "x",
          "type": "linear",
          "nice": true, "zero": true,
          "range": "width",
          "domain": [0,10]
        }, {
          "name": "y",
          "type": "linear",
          "range": "height",
          "nice": true, "zero": true,
          "domain": {"data": "table", "field": "plays"}
        }
      ],
      "axes": [
        {"orient": "bottom", "scale": "x", "zindex": 1, "title": "Your Rating" },
        {"orient": "left", "scale": "y", "zindex": 1, "title": "Number of Plays" }
      ],
      "marks": [{
        "type": "symbol",
        "from": {"data": "table"},
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "rating"},
            "y": { "scale": "y", "field": "plays"},
            "size": { "field": "size" },
            "tooltip": {"field": "tooltip", "type": "quantitative"}
          }
        }
      }]
    };
  }

  private static avrSpec(values: object): VisualizationSpec {
    const star = "M0,0.2L0.2351,0.3236 0.1902,0.0618 0.3804,-0.1236 0.1175,-0.1618 0,-0.4 -0.1175,-0.1618 -0.3804,-0.1236 -0.1902,0.0618 -0.2351,0.3236 0,0.2Z";
    const house = "M-0.5,0L0,-0.5 0.5,0 0.3,0 0.3,0.5 0.05,0.5 0.05,0.2 -0.05,0.2 -0.05,0.5 -0.3,0.5 -0.3,0 -0.5,0Z";
    const heart = "M0.3408,0.0984c0.0507,0,0.0919,0.0413,0.0919,0.0923c0,0.0262,-0.0109,0.0498,-0.0283,0.0666L0.256,0.4071L0.105,0.2546c-0.0158,-0.0166,-0.0256,-0.0391,-0.0256,-0.0639c0-0.051,0.0411,-0.0923,0.0919,-0.0923c0.0382,0,0.0709,0.0234,0.0848,0.0568C0.2698,0.1219,0.3026,0.0984,0.3408,0.0984 M0.3408,0.083z";
    const spec = {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "title": "Average vs Rating",
      "autosize": { "type": "fit", "resize": true, "contains": "padding" },
      "width": 600,
      "height": 600,
      "config": { },
      "data": [ { values, name: "table" } ],
      "scales": [ {
          "name": "x",
          "type": "linear",
          "nice": true, "zero": true,
          "domain": [0,10],
          "range": "width"
        }, {
          "name": "y",
          "type": "linear",
          "nice": true, "zero": true,
          "domain": [0,10],
          "range": "height"
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
        {"orient": "bottom", "scale": "x", "zindex": 1, "title": "Your Rating", "domain": false },
        {"orient": "left", "scale": "y", "zindex": 1, "title": "BGG Average", "domain": false, "grid": true }
      ],
      "marks": [{
        "type": "symbol",
        "from": {"data": "table"},
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "rating"},
            "y": { "scale": "y", "field": "average"},
            "size": 150,
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
    return spec as VisualizationSpec;
  }

  public ngOnInit() {
    this.dataSubscription = this.data$.subscribe(data => this.data = data);
  }

  public ngOnDestroy() {
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
  }

  public getId(): string {
    return "favourites";
  }

  protected getQueryResultFormat(): string {
    return "CollectionWithPlays";
  }

  protected getQueryVariables(): { [p: string]: string } {
    return {};
  }

  protected getApiKey(): string {
    return "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ";
  }

  private static extractAvgVsRating(data: CollectionWithPlays): object {
    const values = [];
    const gameById = {};
    console.log(data);
    for (const gd of data.games) {
      gameById[gd.bggid] = gd;
    }
    for (const gg of data.collection) {
      if (gg.rating > 0 && gameById[gg.bggid].bggRating) {
        values.push({
          rating: gg.rating,
          average: gameById[gg.bggid].bggRating,
          tooltip: gameById[gg.bggid].name,
          subdomain: gameById[gg.bggid].subdomain
        });
      }
    }
    return values;
  }

  private static extractRatingVsPlays(data: CollectionWithPlays): object {
    const values = [];
    const doneKeys = [];
    const playsByGame = {};
    for (const gp of data.plays) {
      playsByGame[gp.game] = gp.plays;
    }
    const gameById = {};
    for (const game of data.games) {
      gameById[game.bggid] = game;
    }
    const sizeSoFar = {};
    const tooltips = {};
    for (const gg of data.collection) {
      if (gg.rating > 0) {
        const plays = Math.min(playsByGame[gg.bggid] || 0, 40);
        const key = "" + gg.rating + "+" + plays;
        sizeSoFar[key] = (sizeSoFar[key] || 0) + 1;
        if (!tooltips[key]) tooltips[key] = [];
        tooltips[key].push(gameById[gg.bggid].name);
        const xy = { rating: gg.rating, plays };
        if (doneKeys.indexOf(key) < 0) {
          values.push(xy);
          doneKeys.push(key);
        }
      }
    }
    for (const xy of values) {
      const key = "" + xy.rating + "+" + xy.plays;
      xy.size = sizeSoFar[key] * 10;
      xy.tooltip = tooltips[key].join(", ");
    }
    return values;
  }

  private static extractRatingVsMonths(data: CollectionWithPlays): object {
    const values = [];
    const monthsByGame = {};
    for (const gp of data.plays) {
      monthsByGame[gp.game] = gp.distinctMonths;
    }
    const gameById = {};
    for (const game of data.games) {
      gameById[game.bggid] = game;
    }
    for (const gg of data.collection) {
      if (gg.rating > 0) {
        const months = monthsByGame[gg.bggid] || 0;
        values.push({ rating: gg.rating, months, tooltip: gameById[gg.bggid].name, subdomain: gameById[gg.bggid].subdomain });
      }
    }
    return values;
  }
}
