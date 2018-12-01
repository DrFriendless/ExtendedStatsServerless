import { Component, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Observable, of } from "rxjs";
import { startWith, flatMap } from "rxjs/operators";
import { HttpClient, HttpParams } from "@angular/common/http";

@Component({
  selector: "autocomplete-demo-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent implements OnInit {
  public control: FormControl = new FormControl();
  public filteredOptions: Observable<string[]>;

  constructor(private http: HttpClient) { }

  public ngOnInit() {
    this.filteredOptions = this.control.valueChanges.pipe(
      startWith(""),
      flatMap(val => this.filter(val))
    );
  }

  private filter(val: string): Observable<string[]> {
    if (val === "") return of([]);
    return this.http
      .get("http://eb.drfriendless.com/findgeeks/" + val) as Observable<string[]>;
  }
}
