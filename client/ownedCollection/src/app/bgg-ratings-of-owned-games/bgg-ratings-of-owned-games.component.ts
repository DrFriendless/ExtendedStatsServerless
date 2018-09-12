import { Component, OnInit, Input, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Collection, GameData, makeGamesIndex, roundRating } from "extstats-core";
import {Observable} from "rxjs/internal/Observable";
import {Subscription} from "rxjs/internal/Subscription";
import {VisualizationSpec, vega} from "vega-embed";
import embed from "vega-embed";

@Component({
  selector: 'bgg-ratings-owned',
  templateUrl: './bgg-ratings-of-owned-games.component.html'
})
export class BggRatingsOfOwnedGamesComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input('data') data$: Observable<Collection>;
  @ViewChild('target') target: ElementRef;
  private subscription: Subscription;
  public rows = [];
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

  public ngOnInit() {

  }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  public ngAfterViewInit() {
    this.subscription = this.data$.subscribe(collection => this.processData(collection));
  }

  private emptyData(): { counts: number[], names: string[][] } {
    return {
      counts: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
      names: [ [], [], [], [], [], [], [], [], [], [] ]
    };
  }

  private processData(collection: Collection) {
    const data = this.emptyData();
    const gamesIndex = makeGamesIndex(collection.games);
    collection.collection.forEach(gg => {
      const g = gamesIndex[gg.bggid];
      if (g && gg.rating > 0) {
        const rating = roundRating(g.bggRating);
        data.counts[rating-1]++;
        data.names[rating-1].push(g.name);
      }
    });
    this.refreshChart(data);
  }

  private refreshChart(data: { counts: number[], names: string[][] }) {
    const chartData = [];
    for (let rating=1; rating<=10; rating++) {
      const count = data.counts[rating-1];
      const names = data.names[rating-1];
      names.sort();
      chartData.push({rating: rating+1, count, tooltip: "" + rating + ". " + names.join(", ") });
    }
    const spec: VisualizationSpec = {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "padding": 5,
      "title": "BGG's Ratings of Games You Own",
      "width": 600,
      "height": 600,
      "signals": [
        { "name": "startAngle", "value": 0 },
        { "name": "endAngle", "value": 6.283 },
        { "name": "padAngle", "value": 0 },
        { "name": "innerRadius", "value": 0 },
        { "name": "cornerRadius", "value": 10 },
        { "name": "sort", "value": false }
      ],
      "scales": [
        {
          "name": "colour",
          "type": "ordinal",
          "range": this.ALDIES_COLOURS,
          "domain": {"data": "table", "field": "rating"}
        }
      ],

      "marks": [
        {
          "type": "arc",
          "from": {"data": "table"},
          "encode": {
            "enter": {
              "fill": {"scale": "colour", "field": "rating"},
              "x": {"signal": "width / 2"},
              "y": {"signal": "height / 2"},
              "tooltip": {"field": "tooltip", "type": "quantitative"}
            },
            "update": {
              "startAngle": {"field": "startAngle"},
              "endAngle": {"field": "endAngle"},
              "padAngle": {"signal": "padAngle"},
              "innerRadius": {"signal": "innerRadius"},
              "outerRadius": {"signal": "width / 2"},
              "cornerRadius": {"signal": "cornerRadius"},
              "fillOpacity": {"value": 1}
            },
            "hover": {
              "fillOpacity": {"value": 0.5}
            }
          }
        }
      ],
      "data": [{
        "name": "table",
        "values": chartData,
        "transform": [{
          "type": "pie",
          "field": "count",
          "startAngle": {"signal": "startAngle"},
          "endAngle": {"signal": "endAngle"},
          "sort": {"signal": "sort"}
        }]
      }]
    };
    embed(this.target.nativeElement, spec, { actions: true });
  }
}
