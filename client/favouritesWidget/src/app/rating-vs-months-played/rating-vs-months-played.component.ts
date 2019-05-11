import { Component, ViewChild, ElementRef } from '@angular/core';
import { DataViewComponent } from "extstats-angular";
import { CollectionWithPlays } from "extstats-core";
import { VisualizationSpec } from "vega-embed";
import embed from "vega-embed";

type RatingVsMonthsData = { rating: number, months: number, tooltip: string, subdomain: string };

@Component({
  selector: 'extstats-rating-vs-months-played',
  templateUrl: './rating-vs-months-played.component.html'
})
export class RatingVsMonthsPlayedComponent extends DataViewComponent<CollectionWithPlays> {
  @ViewChild('target') target: ElementRef;

  protected processData(data: CollectionWithPlays): any {
    if (data) {
      const chartData = this.extractRatingVsMonths(data);
      const spec = this.ratingsVsMonths(chartData);
      embed(this.target.nativeElement, spec, { actions: true });
    }
  }

  private extractRatingVsMonths(data: CollectionWithPlays): RatingVsMonthsData[] {
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

  private ratingsVsMonths(values: RatingVsMonthsData[]): VisualizationSpec {
    const star = "M0,0.2L0.2351,0.3236 0.1902,0.0618 0.3804,-0.1236 0.1175,-0.1618 0,-0.4 -0.1175,-0.1618 -0.3804,-0.1236 -0.1902,0.0618 -0.2351,0.3236 0,0.2Z";
    return {
      "$schema": "https://vega.github.io/schema/vega/v4.json",
      "hconcat": [],
      "autosize": {
        "type": "fit",
        "resize": true
      },
      "width": 900,
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
}
