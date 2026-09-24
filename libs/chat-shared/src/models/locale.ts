/** One additional (non-primary) locale's translation of an entity's name and description. */
export interface LocalizedTextEntry {
  /** Stable client-side id for list rendering; not part of the persisted locale map. */
  id: string;
  /** Locale code this entry translates into (e.g. `'de'`). */
  language: string;
  /** Translated name for this locale. */
  name: string;
  /** Translated description for this locale. */
  description: string;
}

/** A selectable language option for an additional-locale row. */
export interface LocaleOption {
  /** Locale code (e.g. `'de'`). */
  code: string;
  /** Display label for the option (e.g. `'DE'`). */
  label: string;
}
