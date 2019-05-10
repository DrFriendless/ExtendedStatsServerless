import { Component } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { DataSourceComponent, UserDataService } from "extstats-angular";
import { Collection } from "extstats-core";

@Component({
  selector: 'owned-collection',
  templateUrl: './app.component.html'
})
export class UserOwnedComponent extends DataSourceComponent<Collection> {
  private static DEFAULT_SELECTOR = "owned(ME)";

  constructor(http: HttpClient, userDataService: UserDataService) {
    super(http, userDataService, UserOwnedComponent.DEFAULT_SELECTOR);
  }

  public getId(): string {
    return "owned";
  }

  protected getQueryResultFormat(): string {
    return "Collection";
  }

  protected getQueryVariables(): { [p: string]: string } {
    return {};
  }

  protected getApiKey(): string {
    return "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ";
  }
}
