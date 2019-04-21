import { Component, OnInit } from '@angular/core';
import { PlaysSourceComponent, UserDataService } from "extstats-angular";
import { MultiGeekPlays, PlaysQuery } from "extstats-core";
import { HttpClient } from "@angular/common/http";
import { PlayIndexService } from './play-index.service';

@Component({
  selector: 'plays-widget',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class PlaysWidget extends PlaysSourceComponent<MultiGeekPlays> implements OnInit {
  constructor(http: HttpClient, userDataService: UserDataService, private playIndexService: PlayIndexService) {
    super(http, userDataService);
  }

  public ngOnInit() {
    super.ngOnInit();
    this.data$.subscribe(v => this.playIndexService.processData(v));
  }

  public getId(): string {
    return "plays";
  }

  protected getQueryResultFormat(): string {
    return "MultiGeekPlays";
  }

  protected getQueryVariables(): { [p: string]: string } {
    return {};
  }

  protected getApiKey(): string {
    return "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ";
  }

  protected buildQuery(geek: string): PlaysQuery | undefined {
    return geek ? { geek } : undefined;
  }
}
