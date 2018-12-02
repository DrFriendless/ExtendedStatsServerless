import { Component } from '@angular/core';
import { DataSourceComponent } from "extstats-angular";
import { CollectionWithPlays } from "extstats-core";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: 'plays-widget',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class PlaysWidget extends DataSourceComponent<CollectionWithPlays> {
  private static DEFAULT_SELECTOR = "played(ME)";

  constructor(http: HttpClient) {
    super(http, PlaysWidget.DEFAULT_SELECTOR);
  }

  public getId(): string {
    return "plays";
  }

  protected getQueryResultFormat(): string {
    return "CollectionWithPlays";
  }

  protected getQueryVariables(): { [p: string]: string } {
    return {};
  }

  protected getApiKey(): string {
    return "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ";
  }

  protected getExtra(): { [key: string]: any } {
    return { extra: "minus(played(ME), expansions(), books())" };
  }
}
