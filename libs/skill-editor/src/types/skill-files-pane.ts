/** Which rendering of the Files pane an action started from; the pane renders once per breakpoint. */
export enum SkillFilesPane {
  /** The collapsible Files accordion shown below the `desktop` breakpoint. */
  Mobile = 'mobile',
  /** The always-visible Files sidebar shown at the `desktop` breakpoint. */
  Desktop = 'desktop',
}
