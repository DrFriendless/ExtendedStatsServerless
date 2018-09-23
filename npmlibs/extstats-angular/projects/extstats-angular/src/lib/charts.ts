import {CollectionWithPlays} from "extstats-core";
import {VisualizationSpec} from "vega-embed";

export class ChartDefinition {
  constructor(public name: string,
              private extract: (CollectionWithPlays) => object,
              private mkSpec: (object) => VisualizationSpec) {
  }

  public extractData(data: CollectionWithPlays): object {
    return this.extract(data);
  }

  public makeSpec(values: object) {
    return this.mkSpec(values);
  }
}

export class ChartSet {
  public charts: ChartDefinition[] = [];

  public add(chart: ChartDefinition) {
    this.charts.push(chart);
  }
}
