import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import {Subject} from "rxjs/internal/Subject";
import { Subscription} from "rxjs/internal/Subscription";
import {flatMap, tap} from "rxjs/operators";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {FAQCount} from "extstats-core";

@Component({
  selector: 'extstats-faq',
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  public selected = 0;
  private clicks = new Subject<number[]>();
  private readonly subscription: Subscription;
  public faqCounts: { [index: number]: FAQCount } = {};

  public faqs = [
    {
      index: 1,
      head: "What is this site all about?",
      body: "<p>If you're a board game addict, you probably own a lot of board games. Maybe hundreds or thousands. " +
      "And if you have a collection like that, you're a <a href=\"https://boardgamegeek.com\">boardgamegeek.com</a> user. " +
      "Also, you have trouble keeping track of your collection, for example which games you haven't even played. " +
      "If you need statistical insights into your board game collection, this site is made for you.</p>"
    },
    {
      index: 2,
      head: "How do I get to use the site?",
      body: "<p>First of all, take a look at <a href=\"/wartable.html\">the War Table</a> where all users are listed to see if " +
      "you're there. If so, just follow the link from your BGG user name. If not, send geekmail to BGG user Friendless and " +
      "ask to be added to the site. Some time later you'll receive a reply saying you're in.</p>"
    },
    {
      index: 3,
      head: "Do I have to sign up for an account here?",
      body: "<P>No, you don't have to. An accout here is an entirely separate thing to having your BGG username in the list. " +
      "An account here will allow you to save configurations that you like and probably other stuff in the future.</P>"
    },
    {
      index: 4,
      head: "I have an idea for something you could implement!",
      body: "<p>Yes, you and a hundred other people. Sorry, but it's true. " +
      "At the moment I'm quite overwhelmed trying to reproduce the functionality " +
      "of the old site (You didn't know about the old site? <a href=\"http://blog.drfriendless.com/2018/07/07/why-rewrite/\">Read this</a>). " +
      "When this site is about as good as the old site and users are migrating, I'll get to new ideas. " +
      "In the mean time, you're welcome to discuss new ideas in the guild (see the link at the top of the page), " +
      "or if you're a web developer, send a PM to Friendless on BGG to talk about helping.</p>"
    }
  ];

  constructor(private http: HttpClient) {
    const options = {
      headers: new HttpHeaders().set("x-api-key", "gb0l7zXSq47Aks7YHnGeEafZbIzgmGBv5FouoRjJ")
    };
    this.subscription = this.clicks.asObservable().pipe(
      flatMap(clix => this.http.post("https://api.drfriendless.com/v1/faqcount", clix, options)))
      .subscribe(faqData => {
        this.indexFAQData(faqData as FAQCount[]);
      });
  }

  public ngAfterViewInit() {
    this.clicks.next([]);
  }

  public ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  private indexFAQData(faqData: FAQCount[]) {
    let i = 0;
    while (i < faqData.length) {
      this.faqCounts[i+1] = faqData[i];
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
}
