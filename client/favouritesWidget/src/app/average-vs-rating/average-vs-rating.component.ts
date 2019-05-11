import { Component, ElementRef, ViewChild } from "@angular/core";
import { DataViewComponent } from "extstats-angular";
import { CollectionWithPlays } from "extstats-core";
import embed, { VisualizationSpec } from "vega-embed";

type AverageVsRatingData = { rating: number, average: number, tooltip: string, subdomain: string };

@Component({
  selector: 'extstats-average-vs-rating',
  templateUrl: './average-vs-rating.component.html'
})
export class AverageVsRatingComponent extends DataViewComponent<CollectionWithPlays> {
  @ViewChild('target') target: ElementRef;

  protected processData(data: CollectionWithPlays): any {
    if (data) {
      const chartData = this.extractAvgVsRating(data);
      const spec = this.avrSpec(chartData);
      embed(this.target.nativeElement, spec, { actions: true });
    }
  }

  private extractAvgVsRating(data: CollectionWithPlays): AverageVsRatingData[] {
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

  private avrSpec(values: AverageVsRatingData[]): VisualizationSpec {
    const star = "M0,0.2L0.2351,0.3236 0.1902,0.0618 0.3804,-0.1236 0.1175,-0.1618 0,-0.4 -0.1175,-0.1618 -0.3804,-0.1236 -0.1902,0.0618 -0.2351,0.3236 0,0.2Z";
    const house = "M-0.5,0L0,-0.5 0.5,0 0.3,0 0.3,0.5 0.05,0.5 0.05,0.2 -0.05,0.2 -0.05,0.5 -0.3,0.5 -0.3,0 -0.5,0Z";
    const heart = "M0.3408,0.0984c0.0507,0,0.0919,0.0413,0.0919,0.0923c0,0.0262,-0.0109,0.0498,-0.0283,0.0666L0.256,0.4071L0.105,0.2546c-0.0158,-0.0166,-0.0256,-0.0391,-0.0256,-0.0639c0-0.051,0.0411,-0.0923,0.0919,-0.0923c0.0382,0,0.0709,0.0234,0.0848,0.0568C0.2698,0.1219,0.3026,0.0984,0.3408,0.0984 M0.3408,0.083z";
    const spec = {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "autosize": { "type": "fit", "resize": true, "contains": "padding" },
      "width": 900,
      "height": 600,
      "config": { },
      "data": [ { values, name: "table" } ],
      "scales": [ {
        "name": "x",
        "type": "linear",
        "nice": true, "zero": true,
        "domain": [0, 10],
        "range": "width"
      }, {
        "name": "y",
        "type": "linear",
        "nice": true, "zero": true,
        "domain": [0, 10],
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
}
