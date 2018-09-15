import { Component, ViewChild, ElementRef } from '@angular/core';
import { Collection, GameData, makeGamesIndex, roundRating } from "extstats-core";
import {VisualizationSpec, vega} from "vega-embed";
import embed from "vega-embed";
import {DataViewComponent} from "../data-view-component";

@Component({
  selector: 'ratings-owned-charts',
  templateUrl: './ratings-of-owned-games.component.html'
})
export class RatingsOfOwnedGamesComponent extends DataViewComponent<Collection> {
  @ViewChild('target') target: ElementRef;
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

  private emptyData(): { counts: number[], names: string[][] } {
    return {
      counts: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
      names: [ [], [], [], [], [], [], [], [], [], [] ]
    };
  }

  protected processData(collection: Collection) {
    const data = this.emptyData();
    const gamesIndex = makeGamesIndex(collection.games);
    collection.collection.forEach(gg => {
      const g = gamesIndex[gg.bggid];
      if (g && gg.rating > 0) {
        const rating = roundRating(gg.rating);
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
      chartData.push({rating, count, tooltip: "" + rating + ". " + names.join(", ") });
    }
    const spec: VisualizationSpec = {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "padding": 5,
      "title": "Your Ratings of Games You Own",
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
