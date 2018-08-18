import { Component, OnInit, Input } from '@angular/core';
import {DocumentationContent} from "./documentation";

@Component({
  selector: 'extstats-documentation',
  templateUrl: './extstats-documentation.component.html',
  styleUrls: ['./extstats-documentation.component.css']
})
export class ExtstatsDocumentationComponent implements OnInit {
  @Input() collapsed: boolean;
  @Input() content: DocumentationContent[];

  public constructor() { }

  public ngOnInit() {
  }
}
