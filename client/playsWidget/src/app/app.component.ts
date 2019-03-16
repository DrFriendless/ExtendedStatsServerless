import { Component } from '@angular/core';
import { PlaysSourceComponent } from "extstats-angular";
import { MultiGeekPlays } from "extstats-core";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: 'plays-widget',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class PlaysWidget extends PlaysSourceComponent<MultiGeekPlays> {
  constructor(http: HttpClient) {
    super(http);
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
