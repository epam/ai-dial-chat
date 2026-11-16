/** A DIAL Core org unit: an organisation's folder in the public bucket. */
export interface OrgUnit {
  id: string;
  /** Unit name; also the last segment of its folder. */
  name: string;
  /** Name to show people; equals `name` when Core has none. */
  displayName: string;
  /** Decoded unit address without a trailing slash, e.g. `public/Acme/US Risk`. */
  path: string;
  /** Unit folder as DIAL Core returns it: url-encoded, with a trailing slash, e.g. `public/Acme/US%20Risk/`. */
  folder: string;
}
