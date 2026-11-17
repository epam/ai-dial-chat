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
  /**
   * The caller's actions per Core namespace in this unit, e.g.
   * `{ applications: ['read', 'write'] }`. Empty when the unit is reached only
   * through its parent. Decisions use this map, never role names.
   */
  permissions: Record<string, string[]>;
}

/** DIAL Core resource namespaces an org unit grants actions on. */
export enum OrgUnitNamespace {
  Files = 'files',
  Conversations = 'conversations',
  Prompts = 'prompts',
  Applications = 'applications',
  Toolsets = 'toolsets',
  Skills = 'skills',
  Projects = 'projects',
  Publications = 'publications',
}

/** Actions Core grants per namespace in a unit. */
export enum OrgUnitAction {
  Read = 'read',
  Write = 'write',
}

/** The resolved org-unit data a right is decided from. */
export interface OrgUnitAccess {
  /** `true` for a DIAL admin, who may act anywhere. */
  hasAdminAccess: boolean;
  units: readonly OrgUnit[];
}
