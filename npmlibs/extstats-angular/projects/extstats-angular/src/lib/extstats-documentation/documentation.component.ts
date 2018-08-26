import { Component, AfterViewInit, Input } from '@angular/core';
import {DocumentationContent} from "./documentation";
import {Observable} from "rxjs/internal/Observable";
import {HttpClient} from "@angular/common/http";

@Component({
  selector: 'extstats-documentation',
  templateUrl: './documentation.component.html',
  styleUrls: ['./documentation.component.css']
})
export class DocumentationComponent implements AfterViewInit {
  @Input() collapsed: boolean;
  @Input() src: string;
  public content$: Observable<DocumentationContent>;

  public constructor(private http: HttpClient) { }

  public ngAfterViewInit() {
    this.content$ = this.http.get(this.src) as Observable<DocumentationContent>;
  }
}
