/** Native branch selected by measured history availability. */
export enum HistoryLadderMode {
  History = 'history',
  Drawn = 'drawn',
}

/** The six ordered stations understood by the history-ladder capability. */
export enum HistoryLadderAnchor {
  Row0 = 'row-0',
  Row1 = 'row-1',
  Row2 = 'row-2',
  Row3 = 'row-3',
  Row4 = 'row-4',
  Row5 = 'row-5',
}

/** Independently bound native position tracks. */
export enum HistoryLadderTrack {
  Actor = 'actor',
  Copy = 'copy',
  Flight = 'flight',
}

/** Optional viewport references for authored arrivals and departures. */
export enum HistoryLadderViewportAnchor {
  Start = 'viewport-start',
  End = 'viewport-end',
}
