/** Load state of the org units read by `useOrgUnits`. */
export enum OrgUnitsStatus {
  /** Nothing has asked for the units yet. */
  Idle = 'idle',
  /** The read is in flight. */
  Loading = 'loading',
  /** The units are loaded. */
  Ready = 'ready',
  /** DIAL Core has org units turned off. */
  Disabled = 'disabled',
  /** The read failed; no units are known. */
  Error = 'error',
}
