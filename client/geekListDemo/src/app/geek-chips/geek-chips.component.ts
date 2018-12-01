import { Component, Input } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'geek-chips',
  templateUrl: './geek-chips.component.html',
  styleUrls: ['./geek-chips.component.css']
})
export class GeekChipsComponent {
  public geeks: string[] = [];

  public addGeek(geek: string) {
    if (this.geeks.indexOf(geek) < 0) this.geeks.push(geek);
  }

  public remove(geek: string): void {
    const index = this.geeks.indexOf(geek);
    if (index >= 0) this.geeks.splice(index, 1);
  }
}
