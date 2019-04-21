import { PlaysWithDate } from 'extstats-core';
import { ymd } from './library';

type NickelDime = { nickel: number[], dime: number[], quarter: number[], dollar: number[] };

/**
 * A set of plays with dates, indexed for easy retrieval of useful data.
 */
export class PlayIndex {
  private index: Record<number, PlaysWithDate[]> = {};
  // new games played in period
  private newIndex: Record<number, number[]> = {};
  private everPlayed = new Set<number>();
  // plays ever of each game
  private playsPerGame: Record<number, number> = {};
  private nds: Record<number, NickelDime> = {};

  public addPlay(pwd: PlaysWithDate) {
    if (!this.playsPerGame[pwd.game]) this.playsPerGame[pwd.game] = 0;
    const before = this.playsPerGame[pwd.game];
    const after = before + pwd.quantity;
    // console.log({ before, after });
    this.addPlayForPeriod(pwd.year, pwd, before, after);
    this.addPlayForPeriod(pwd.year * 100 + pwd.month, pwd, before, after);
    this.addPlayForPeriod(pwd.year * 10000 + pwd.month * 100 + pwd.date, pwd, before, after);
    this.playsPerGame[pwd.game] = after;
    this.everPlayed.add(pwd.game);
  }

  public addPlayForPeriod(period: number, pwd: PlaysWithDate, before: number, after: number) {
    if (!this.index[period]) {
      this.index[period] = [pwd];
    } else {
      this.index[period].push(pwd);
    }
    if (!this.everPlayed.has(pwd.game)) {
      if (!this.newIndex[period]) {
        this.newIndex[period] = [pwd.game];
      } else {
        this.newIndex[period].push(pwd.game);
      }
    }
    if (!this.playsPerGame[pwd.game]) this.playsPerGame[pwd.game] = 0;
    if (before < 5 && after >= 5) {
      const nd = this.nds[period];
      if (!nd) {
        this.nds[period] = { nickel: [pwd.game], dime: [], dollar: [], quarter: [] };
      } else {
        nd.nickel.push(pwd.game);
      }
    }
    if (before < 10 && after >= 10) {
      const nd = this.nds[period];
      if (!nd) {
        this.nds[period] = { nickel: [], dime: [pwd.game], dollar: [], quarter: [] };
      } else {
        nd.dime.push(pwd.game);
      }
    }
    if (before < 25 && after >= 25) {
      const nd = this.nds[period];
      if (!nd) {
        this.nds[period] = { nickel: [], dime: [], dollar: [], quarter: [pwd.game] };
      } else {
        nd.quarter.push(pwd.game);
      }
    }
    if (before < 100 && after >= 100) {
      const nd = this.nds[period];
      if (!nd) {
        this.nds[period] = { nickel: [], dime: [], dollar: [pwd.game], quarter: [] };
      } else {
        nd.dollar.push(pwd.game);
      }
    }
  }

  public getTotalPlays(period: number): { count: number, distinct: number, dates: number, new: number[] } {
    let total = 0;
    const ids = new Set<number>();
    const dates = new Set<number>();
    const plays = this.index[period];
    if (plays && plays.length > 0) {
      for (const p of plays) {
        total += p.quantity;
        ids.add(p.game);
        dates.add(ymd(p));
      }
    }
    const newGames = !!this.newIndex[period] ? this.newIndex[period] : [];
    return { count: total, distinct: ids.size, dates: dates.size, new: newGames };
  }

  public getPlays(period: number): PlaysWithDate[] {
    return this.index[period];
  }

  public getNickelAndDimes(period: number): NickelDime {
    if (!this.nds[period]) {
      return { nickel: [], dime: [], quarter: [], dollar: [] };
    } else {
      return this.nds[period];
    }
  }

  public getNewGames(period: number): number[] {
    return this.newIndex[period];
  }

  public getYearKeys(): number[] {
    const result: number[] = [];
    for (const period in Object.keys(this.index)) {
      if (period.length === 4) {
        result.push(parseInt(period));
      }
    }
    return result;
  }

  public getMonthKeys(): number[] {
    const result: number[] = [];
    for (const period of Object.keys(this.index).filter(k => k.length === 6)) {
      result.push(parseInt(period));
    }
    return result;
  }
}
