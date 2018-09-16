import { Component } from '@angular/core';
import {DataSourceComponent} from "extstats-angular";
import {CollectionWithMonthlyPlays} from "extstats-core";
import {HttpClient} from "@angular/common/http";

@Component({
  selector: 'monthly-plays',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class MonthlyWidget extends DataSourceComponent<CollectionWithMonthlyPlays> {
  private static DEFAULT_SELECTOR = "played(ME)";

  constructor(http: HttpClient) {
    super(http, MonthlyWidget.DEFAULT_SELECTOR);
  }

  public getId(): string {
    return "monthly";
  }

  protected getQueryResultFormat(): string {
    return "CollectionWithMonthlyPlays";
  }

  protected getQueryVariables(): { [p: string]: string } {
    return {};
  }

  protected getApiKey(): string {
    return "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ";
  }
}
