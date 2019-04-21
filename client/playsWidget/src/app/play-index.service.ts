import { Injectable } from '@angular/core';
import { makeGamesIndex, MultiGeekPlays, PlaysWithDate } from 'extstats-core';
import { ymd, GameIndex } from './library';
import { PlayIndex } from './play-index';
import { Subject } from 'rxjs/internal/Subject';
import { share } from 'rxjs/operators';

export type PlayAndGamesIndex = { playIndex: PlayIndex, gamesIndex: GameIndex, years: number[] };

@Injectable({
  providedIn: 'root'
})
export class PlayIndexService {
  private data = new Subject<PlayAndGamesIndex>();
  public data$ = this.data.asObservable().pipe(share());

  constructor() { }

  public processData(data: MultiGeekPlays) {
    if (data && data.geeks.length > 0) {
      const geek = data.geeks[0];
      const plays: PlaysWithDate[] = data.plays[geek];
      if (!plays || plays.length === 0) return;
      plays.sort((a, b) => ymd(a) - ymd(b));
      const playIndex = new PlayIndex();
      const years: number[] = [];
      for (const pwd of plays) {
        if (years.indexOf(pwd.year) < 0) years.push(pwd.year);
        playIndex.addPlay(pwd);
      }
      const gamesIndex = makeGamesIndex(data.games);
      this.data.next({ playIndex, gamesIndex, years });
    } else {
      this.data.next({ playIndex: new PlayIndex(), gamesIndex: {}, years: [] });
    }
  }
}
