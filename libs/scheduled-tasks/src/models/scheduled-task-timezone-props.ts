/** One selectable row of the time zone picker, resolved and sorted by the host. */
export interface ScheduledTaskTimezoneOption {
  /** IANA identifier sent to the API, such as `Europe/Berlin`. */
  id: string;
  /** Offset shown in the first column, such as `GMT+01:00`. */
  offsetLabel: string;
  /** Offset from UTC in minutes; the host sorts by it, the lib only reads it for display decisions. */
  offsetMinutes: number;
  /** Letter abbreviation shown after the identifier, such as `CET`. Omitted when the platform has none. */
  abbreviation?: string;
  /** Lower-cased strings a search query is matched against (offset variants, identifier with spaces, abbreviations). */
  searchTerms: string[];
}

/** Localized strings of the time zone picker; every one has an English default. */
export interface ScheduledTaskTimezoneLabels {
  /** Text of the link that opens the picker. Defaults to `'Change timezone'`. */
  changeLabel?: string;
  /** Accessible name of the picker dialog. Defaults to `'Time zone'`. */
  dialogAriaLabel?: string;
  /** Placeholder of the search field. Defaults to `'Search city, timezone or offset...'`. */
  searchPlaceholder?: string;
  /** Accessible name of the search field. Defaults to `'Search time zones'`. */
  searchAriaLabel?: string;
  /** Accessible name of the clear button of the search field. Defaults to `'Clear search'`. */
  clearSearchAriaLabel?: string;
  /** Heading of the group holding the browser's zone. Defaults to `'Your time zone'`. */
  yourZoneHeading?: string;
  /** Heading of the group holding every zone. Defaults to `'All time zones'`. */
  allZonesHeading?: string;
  /** Title of the empty state when nothing matches. Defaults to `'No time zones found'`. */
  noResultsTitle?: string;
  /** Description of the empty state when nothing matches. Defaults to `'Try a different city, time zone or offset.'`. */
  noResultsDescription?: string;
  /** Announcement of the number of matching rows. Defaults to `'{count} time zones found'`-style English text. */
  resultsCountLabel?: (count: number) => string;
  /** Accessible name of the list of zones. Defaults to `'Time zones'`. */
  listAriaLabel?: string;
  /** Hint shown when a one-time run time does not exist in the zone; receives the local time the task will run at. Defaults to an English sentence. */
  gapHintLabel?: (shiftedTime: string) => string;
}

/** Color overrides of the time zone picker, applied as CSS custom properties. */
export interface ScheduledTaskTimezoneColors {
  /** Color of the "Change timezone" link. Defaults to `--text-accent`. */
  linkColor?: string;
  /** Color of the group headings. Defaults to `--text-secondary`. */
  headingColor?: string;
  /** Color of the offset column. Defaults to `--text-secondary`. */
  offsetColor?: string;
  /** Color of the zone identifier. Defaults to `--text-primary`. */
  nameColor?: string;
  /** Color of the abbreviation. Defaults to `--text-secondary`. */
  abbreviationColor?: string;
  /** Color of the DST-gap hint. Defaults to `--text-secondary`. */
  hintColor?: string;
  /** Color of the popover's shadow. Defaults to `--shadow-lg`. */
  shadowColor?: string;
}

/** Typography overrides of the time zone picker; each value is a kit `dial-*-text` class. */
export interface ScheduledTaskTimezoneClassNames {
  /** Class of the "Change timezone" link. Defaults to `'dial-small-semi-text'`. */
  linkClassName?: string;
  /** Class of the group headings. Defaults to `'dial-tiny-lead-semi-text'`. */
  headingClassName?: string;
  /** Class of each row. Defaults to `'dial-small-text'`. */
  rowClassName?: string;
  /** Class of the DST-gap hint. Defaults to `'dial-tiny-text'`. */
  hintClassName?: string;
}

/** Props of the time zone picker field. */
export interface ScheduledTaskTimezoneFieldProps {
  /** Id of the "Change timezone" link. */
  id: string;
  /** Selectable zones, already sorted by the host; rendered in the order given. */
  options: ScheduledTaskTimezoneOption[];
  /** Id of the selected zone. */
  value: string;
  /** Called with the id of the zone the user picked. */
  onChange: (timezoneId: string) => void;
  /** Id of the viewer's own zone, listed first under its own heading; omitted when unknown. */
  browserTimezoneId?: string;
  /** Disables the link, e.g. while the form is submitting. */
  disabled?: boolean;
  /** Whether the selected zone, such as `(GMT+01:00) Europe/Berlin`, is written beside the link. Defaults to `true`; turn it off when the host shows the zone elsewhere, for example inside the time input. */
  isSummaryShown?: boolean;
  /** Id of the element describing the field, such as its error message; set as `aria-describedby` on the link. */
  ariaDescribedBy?: string;
  /** Localized strings, each with an English default. */
  labels?: ScheduledTaskTimezoneLabels;
  /** Color overrides. */
  colors?: ScheduledTaskTimezoneColors;
  /** Typography class overrides. */
  classNames?: ScheduledTaskTimezoneClassNames;
}
