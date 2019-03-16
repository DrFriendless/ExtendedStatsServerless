import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { PlaysViewComponent } from "extstats-angular";
import { CollectionWithPlays, makeGamesIndex, MultiGeekPlays, PlaysWithDate } from "extstats-core";
import { VisualizationSpec } from "vega-embed";
import embed from "vega-embed";

interface YMD {
  year: number;
  month: number;
  date: number;
}

@Component({
  selector: 'new-plays',
  templateUrl: './new-plays.component.html',
  styleUrls: ['./new-plays.component.css']
})
export class NewPlaysComponent extends PlaysViewComponent<MultiGeekPlays> {
  @ViewChild('target') target: ElementRef;

  private star = "M0,0.2L0.2351,0.3236 0.1902,0.0618 0.3804,-0.1236 0.1175,-0.1618 0,-0.4 -0.1175,-0.1618 -0.3804,-0.1236 -0.1902,0.0618 -0.2351,0.3236 0,0.2Z";

  protected processData(plays: MultiGeekPlays) {
    this.refreshChart(plays);
  }

  private compareDate(d1: YMD, d2: YMD): number {
    const v1 = d1.year * 10000 + d1.month * 100 + d1.date;
    const v2 = d2.year * 10000 + d2.month * 100 + d2.date;
    if (v1 < v2) return -1;
    if (v1 > v2) return 1;
    return 0;
  }

  private refreshChart(data: MultiGeekPlays) {
    const firstPlays: ChartPlay[] = [];
    const alreadyPlayedByGeek: { [geek: string]: number[] } = {};
    const gamesIndex = makeGamesIndex(data.games);
    for (const geek of data.geeks) {
      const plays = data.plays[geek];
      if (!alreadyPlayedByGeek[geek]) alreadyPlayedByGeek[geek] = [];
      const playedByThisGeek = alreadyPlayedByGeek[geek];
      plays.sort((p1, p2) => this.compareDate(p1, p2));
      for (const play of plays) {
        if (playedByThisGeek.indexOf(play.game) >= 0) continue;
        playedByThisGeek.push(play.game);
        const game = gamesIndex[play.game];
        firstPlays.push({
          count: playedByThisGeek.length,
          gameName: game.name,
          playDate: new Date(play.year, play.month - 1, play.date),
          geek
        });
      }
      console.log(firstPlays);
      const spec: VisualizationSpec = {
        "$schema": "https://vega.github.io/schema/vega/v4.json",
        "hconcat": [],
        "padding": 5,
        "title": "First Plays",
        "width": 600,
        "height": 600,
        "data": [{
          "name": "table",
          "values": firstPlays
        }],
        "scales": [
          {
            "name": "xscale",
            "type": "time",
            "range": "width",
            "domain": { "data": "table", "field": "playDate" }
          }, {
            "name": "yscale",
            "type": "linear",
            "range": "height",
            "zero": true,
            "domain": { "data": "table", "field": "count" }
          }, {
            "name": "shape",
            "type": "ordinal",
            "domain": data.geeks,
            "range": ['circle', 'square', "cross", 'diamond', 'triangle-up', 'triangle-down', 'triangle-right', "triangle-left", this.star ]
          }
        ],
        "axes": [
          {"orient": "bottom", "scale": "xscale", "zindex": 1},
          {"orient": "left", "scale": "yscale", "zindex": 1}
        ],
        "marks": [
          {
            "type": "symbol",
            "from": {"data": "table"},
            "encode": {
              "enter": {
                "x": { "scale": "xscale", "field": "playDate"},
                "y": { "scale": "yscale", "field": "count"},
                "tooltip": {"field": "gameName", "type": "quantitative"},
                "stroke": { "value": "#000000" },
                "shape": { "field": "geek", "scale": "shape" },
                "strokeWidth": {"value": 2}
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
}

interface ChartPlay {
  count: number;
  gameName: string;
  playDate: Date;
  geek: string;
}
