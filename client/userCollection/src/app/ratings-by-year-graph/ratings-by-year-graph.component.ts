import { Component, OnDestroy, AfterViewInit, Input, ViewChild, ElementRef } from '@angular/core';
import {Collection, GameData, roundRating, makeGamesIndex } from "extstats-core";
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";
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

  private emptyData(): { [year: number]: { counts: number[], names: string[][] } } {
    const thisYear = (new Date()).getFullYear();
    const result = {};
    for (let y=this.startYear; y<=thisYear; y++) {
      result[y] = {
        counts: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
        names: [[], [], [], [], [], [], [], [], [], []]
      };
    }
    return result;
  }

  private processData(collection: Collection) {
    const data = this.emptyData();
    const gamesIndex = makeGamesIndex(collection.games);
    collection.collection.forEach(gg => {
      const g = gamesIndex[gg.bggid];
      if (g && gg.rating > 0) {
        if (g.yearPublished >= this.startYear) {
          const rating = roundRating(gg.rating);
          data[g.yearPublished].counts[rating-1]++;
          data[g.yearPublished].names[rating-1].push(g.name);
        }
      }
    });
    this.refreshChart(data);
  }

  private refreshChart(data: { [year: number]: { counts: number[], names: string[][] } }) {
    const chartData = [];
    for (let year in data) {
      for (let i=1; i<=10; i++) {
        const count = data[year].counts[i-1];
        chartData.push({x: year, y: count, c: i, t: data[year].names[i-1].join(", ") });
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
              "tooltip": {"field": "t", "type": "quantitative"}
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
    embed(this.target.nativeElement, spec, { actions: true });
  }
}
