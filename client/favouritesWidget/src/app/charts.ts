import {CollectionWithPlays} from "./collection-interfaces";

export class ChartDefinition {
  constructor(private key: string, private name: string, private mark: string, private xAxisName: string, private yAxisName: string,
              private extract: (CollectionWithPlays) => object) {
  }

  public getMark(): string {
    return this.mark;
  }

  public getName(): string {
    return this.name;
  }

  public getKey(): string {
    return this.key;
  }

  public extractData(source: CollectionWithPlays): object {
    return this.extract(source);
  }

  public getXAxisName(): string {
    return this.xAxisName;
  }

  public getYAxisName(): string {
    return this.yAxisName;
  }
}

export class ChartSet {
  public charts: ChartDefinition[] = [];

  public add(chart: ChartDefinition) {
    this.charts.push(chart);
  }
}
