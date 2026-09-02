/** Delay before a queue whose jobs have all succeeded closes itself. */
export const AUTO_CLOSE_DELAY_MS = 8000;
/* Fixed footprint for every trailing status slot so switching between statuses never shifts layout. */
export const STATUS_SLOT_CLASS =
  'flex size-7 shrink-0 items-center justify-center';
