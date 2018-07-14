import { Component } from '@angular/core';
import { AmplifyService } from "aws-amplify-angular";
import Amplify from "aws-amplify/lib/Common/Amplify";
import awsmobile from "./aws-exports";

@Component({
  selector: 'extstats-login',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'extstats-login';

  constructor(public amplifyService: AmplifyService) {
    Amplify.configure(awsmobile);
    amplifyService.auth();
  }
}
