/** Which chrome the History section renders. */
export enum ScheduledTaskHistorySectionVariant {
  /** The desktop self-scrolling raised card with a sticky title/next-run header and a sticky "Show more" footer. */
  Card = 'card',
  /** Standard top-to-bottom page flow with an inline "Show more" footer, used in the mobile/tablet tab panel. */
  Flow = 'flow',
}
