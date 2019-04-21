import { HttpParams } from '@angular/common/http';
import { GameData, PlaysWithDate } from 'extstats-core';

export type GameIndex = { [bggid: number]: GameData };

export const MONTH_NAMES = [ 'Zerouary', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export interface ExpandListener {
  toggleExpand: (number) => void;
}

export class SimplePlays {
  public quantity: number;
  public gameName: string;
  public gameId: number;
}

export class PlaysTableRowModel {
  public yearHeader = false;
  public yearSpan = 1;
  public year = 1996;
  public yearPlays = 0;
  public yearDistinct = 0;
  public yearDates = 0;
  public monthHeader = false;
  public monthSpan = 1;
  public month = 'January';
  public monthKey = 0;
  public monthPlays = 0;
  public monthDistinct = 0;
  public monthDates = 0;
  public dateShown = false;
  public date  = 1;
  public datePlays  = 0;
  public dateKey = 0;
  public dateExpanded = false;
  public dateDistinct = 0;
  public plays: SimplePlays[] = [];
}

export function getParamValueQueryString(paramName: string): string {
  const url = window.location.href;
  let paramValue;
  if (url.includes('?')) {
    const httpParams = new HttpParams({ fromString: url.split('?')[1] });
    paramValue = httpParams.get(paramName);
  }
  return paramValue;
}

export function ymd(play: PlaysWithDate) {
  return play.year * 10000 + play.month * 100 + play.date;
}

export function buildTooltip(gameIndex: GameIndex, games: number[]) {
  return games.map(id => gameIndex[id].name).join(", ");
}
