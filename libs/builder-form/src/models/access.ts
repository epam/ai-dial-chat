/** Rights an entry grants on one kind of content. */
export enum AccessLevel {
  Read = 'read',
  ReadWrite = 'readWrite',
}

/** One kind of content the host lets the author grant access to. */
export interface AccessContentOption {
  /** Stable identifier of the option, unique among the options; stored in `AccessEntry.contentId`. */
  id: string;
  /** Text shown for the option in the dropdown, in chips and in announcements. */
  label: string;
  /** Levels the option allows, in the order the access dropdown lists them. */
  allowedAccess: AccessLevel[];
}

/** A complete access entry: a content option with a level. */
export interface AccessEntry {
  /** `id` of the `AccessContentOption` the entry grants access to. */
  contentId: string;
  /** Rights the entry grants. */
  level: AccessLevel;
}

/** An entry the author cannot edit here, shown as a chip without a remove control. */
export interface AccessReadOnlyChip {
  /** Stable identifier of the chip, unique among the read-only chips. */
  id: string;
  /** Pre-translated chip text. */
  label: string;
}
