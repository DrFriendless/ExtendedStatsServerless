import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { Subject } from "rxjs/internal/Subject";
import { Subscription } from "rxjs/internal/Subscription";
import { Observable } from "rxjs/internal/Observable";
import { flatMap, tap } from "rxjs/operators";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { FAQCount } from "extstats-core";

@Component({
  selector: 'extstats-faq',
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  public selected = 0;
  private clicks = new Subject<number[]>();
  private readonly subscription: Subscription;
  private readonly faqSubscription: Subscription;
  public faqCounts: { [index: number]: FAQCount } = {};
  public faqs: object[] = [];
  public geek: string;

  constructor(private http: HttpClient) {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    this.subscription = this.clicks.asObservable().pipe(
      flatMap(clix => this.http.post("https://api.drfriendless.com/v1/faqcount", clix, options)))
      .subscribe(faqData => {
        this.indexFAQData(faqData as FAQCount[]);
      });
    this.faqSubscription = (this.http.get("/json/en/doc/faqs.json") as Observable<object[]>).pipe(
      tap(x => console.log(x)),
    ).subscribe(faqs => this.faqs = faqs);
  }

  public ngAfterViewInit() {
    this.clicks.next([]);
  }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
    if (this.faqSubscription) this.faqSubscription.unsubscribe();
  }

  private indexFAQData(faqData: FAQCount[]) {
    let i = 0;
    while (i < faqData.length) {
      this.faqCounts[i + 1] = faqData[i];
      i++;
    }
  }

  public toggle(index: number) {
    console.log("toggle " + index);
    if (this.selected === index) {
      this.selected = 0;
    } else {
      this.selected = index;
      this.clicks.next([index]);
    }
    console.log(this.selected);
  }

  public getCount(index: number, key: string): number {
    if (!this.faqCounts[index]) return 0;
    return this.faqCounts[index][key];
  }

  public choose(event) {
    console.log(event);
    this.geek = event;
  }
}
