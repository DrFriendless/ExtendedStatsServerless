import { Component, OnDestroy, AfterViewInit, Input, ViewChild, ElementRef } from '@angular/core';
import {Collection, GameData} from "extstats-core";
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";

// this is only way I could find to import the vega stuff
// declare module 'vega-embed' {
//   export default function embed(e: any, spec: any, ops: any): Promise<any>;
// }
import {VisualizationSpec, vega} from "vega-embed";
import embed from "vega-embed";

@Component({
  selector: 'ratings-by-year-graph',
  templateUrl: './ratings-by-year-graph.component.html'
})
export class RatingsByYearGraphComponent implements OnDestroy, AfterViewInit {
  @Input('data') data$: Observable<Collection>;
  @Input() width = 600;
  @Input() height = 600;
  @ViewChild('target') target: ElementRef;
  private subscription: Subscription;
  private startYear = 1995;
  private readonly ALDIES_COLOURS = [
    '#ff0000',
    '#ff3366',
    '#ff6699',
    '#ff66cc',
    '#cc99ff',
    '#9999ff',
    '#99ffff',
    '#66ff99',
    '#33cc99',
    '#00cc00'];

  constructor() { }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public ngAfterViewInit() {
    this.subscription = this.data$.subscribe(data => this.processData(data));
  }

  private emptyData(): { [year: number]: number[] } {
    const thisYear = (new Date()).getFullYear();
    const result = {};
    for (let y=this.startYear; y<=thisYear; y++) {
      result[y] = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    }
    return result;
  }

  private processData(collection: Collection) {
    const data = this.emptyData();
    const gamesIndex = RatingsByYearGraphComponent.makeGamesIndex(collection.games);
    collection.collection.forEach(gg => {
      const g = gamesIndex[gg.bggid];
      if (g && gg.rating > 0) {
        if (g.yearPublished >= this.startYear) {
          let rating = Math.round(gg.rating);
          if (rating < 1) rating = 1;
          if (rating > 10) rating = 10;
          data[g.yearPublished][rating-1]++;
        }
      }
    });
    this.refreshChart(data);
  }

  private static makeGamesIndex(games: GameData[]): { [bggid: number]: GameData } {
    const result = {};
    games.forEach(gd => result[gd.bggid] = gd);
    return result;
  }

  private refreshChart(data: { [year: number]: number[] }) {
    console.log(data);
    const encoding = {
      "x": {
        "field": "x",
        "type": "quantitative",
        "axis": {
          "title": "Published Year"
        }
      },
      "y": {
        "field": "y",
        "type": "quantitative",
        "axis": {
          "title": "Rating"
        }
      }
    };
    const chartData = [];
    for (let year in data) {
      for (let i=1; i<=10; i++) {
        const count = data[year][i-1];
        chartData.push({x: year, y: count, c: i, t: i.toString() });
      }
    }
    const spec: VisualizationSpec = {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "padding": 5,
      "title": "Ratings By Published Year",
      "width": 600,
      "height": 600,
      "data": [{
        "name": "table",
        "values": chartData,
        "transform": [
          {
            "type": "stack",
            "groupby": ["x"],
            "sort": {"field": "c"},
            "field": "y"
          }
        ]
      }],
      "scales": [
        {
          "name": "x",
          "type": "band",
          "range": "width",
          "domain": {"data": "table", "field": "x"}
        },
        {
          "name": "y",
          "type": "linear",
          "range": "height",
          "nice": true, "zero": true,
          "domain": {"data": "table", "field": "y1"}
        },
        {
          "name": "color",
          "type": "ordinal",
          "range": this.ALDIES_COLOURS,
          "domain": {"data": "table", "field": "c"}
        }
      ],
      "axes": [
        {"orient": "bottom", "scale": "x", "zindex": 1},
        {"orient": "left", "scale": "y", "zindex": 1}
      ],
      "marks": [
        {
          "type": "rect",
          "from": {"data": "table"},
          "encode": {
            "enter": {
              "x": {"scale": "x", "field": "x"},
              "width": {"scale": "x", "band": 1, "offset": -1},
              "y": {"scale": "y", "field": "y0"},
              "y2": {"scale": "y", "field": "y1"},
              "fill": {"scale": "color", "field": "c"},
              // "tooltip": {"field": "t", "type": "quantitative"}
            },
            "update": {
              "fillOpacity": {"value": 1}
            },
            "hover": {
              "fillOpacity": {"value": 0.5}
            }
          }
        }
      ]
    };
    console.log(this.target);
    embed(this.target.nativeElement, spec, { actions: true });
  }
}
