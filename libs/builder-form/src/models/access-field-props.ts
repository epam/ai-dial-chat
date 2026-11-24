import type {
  AccessContentOption,
  AccessEntry,
  AccessReadOnlyChip,
} from './access';

/** Pre-translated labels of `AccessModal`. */
export interface AccessModalLabels {
  /** Title of the modal, and prefix of each card's group name (`'Access 1'`). */
  modalTitle: string;
  /** Placeholder and accessible name of each card's content dropdown. */
  selectContent: string;
  /** Placeholder and accessible name of each card's access dropdown. */
  selectAccess: string;
  /** Text of the read level in the access dropdown and in chips. */
  accessRead: string;
  /** Text of the read-and-write level in the access dropdown and in chips. */
  accessReadWrite: string;
  /** Prefix of each card's delete button name; the card number is appended. */
  deleteCard: string;
  /** Text of the button that discards the draft. */
  cancelLabel: string;
  /** Text of the button that applies the draft. */
  saveLabel: string;
  /** Accessible name of the modal's close control. */
  closeAriaLabel: string;
}

/** Pre-translated labels of `AccessField`; the modal labels are forwarded to `AccessModal`. */
export interface AccessFieldLabels extends AccessModalLabels {
  /** Title of the section. */
  title: string;
  /** One-sentence description under the title. */
  description: string;
  /** Text of the button that opens the modal. */
  configureLabel: string;
  /** Accessible name of a chip's remove control, given the chip text. */
  removeEntry: (entryLabel: string) => string;
  /** Announcement after an entry is added, given the entry text. */
  announceAdded: (entryLabel: string) => string;
  /** Announcement after an entry is removed, given the entry text. */
  announceRemoved: (entryLabel: string) => string;
}

/** CSS custom property overrides for `AccessModal`. */
export interface AccessModalColors {
  /** Background of each card. Defaults to `--bg-layer-base`. */
  cardBackground?: string;
  /** Border color of each card. Defaults to `--stroke-tertiary`. */
  cardBorder?: string;
}

/** CSS custom property overrides for `AccessField` and the modal it opens. */
export interface AccessFieldColors extends AccessModalColors {
  /** Text color of each chip. Defaults to `--text-secondary`. */
  chipText?: string;
}

/** Props accepted by the `AccessModal` component. */
export interface AccessModalProps {
  /** Whether the modal is shown. Each time it opens, the draft restarts from `value`. */
  open: boolean;
  /** Complete entries the draft starts from. */
  value: AccessEntry[];
  /** Content the author can choose from. */
  contentOptions: AccessContentOption[];
  /** Pre-translated labels. */
  labels: AccessModalLabels;
  /** Called with the complete entries of the draft when the author saves. */
  onSave: (entries: AccessEntry[]) => void;
  /** Called when the author cancels, closes the modal or presses Escape; the draft is discarded. */
  onClose: () => void;
  /** Class applied to the popup container. */
  className?: string;
  /** Color overrides, applied as CSS custom properties inside the popup. */
  colors?: AccessModalColors;
}

/** Props accepted by the `AccessField` component. */
export interface AccessFieldProps {
  /** Complete entries currently configured. */
  value: AccessEntry[];
  /** Called with the full updated list when a chip is removed or the modal is saved. */
  onChange: (entries: AccessEntry[]) => void;
  /** Content the author can choose from. */
  contentOptions: AccessContentOption[];
  /** Entries the author cannot edit; shown as chips without a remove control and never listed in the modal. Defaults to an empty list. */
  readOnlyChips?: AccessReadOnlyChip[];
  /** Text of the informational section message; shown only while `value` or `readOnlyChips` is not empty. */
  noticeText?: string;
  /** Pre-translated labels; `DEFAULT_ACCESS_FIELD_LABELS` holds the English defaults. */
  labels: AccessFieldLabels;
  /** Class applied to the section root. */
  className?: string;
  /** Typography class added to the section heading, on top of the kit form section's own. */
  titleClassName?: string;
  /** Typography class added to the description, on top of the kit form section's own. */
  descriptionClassName?: string;
  /** Typography class applied to each chip. Defaults to `'dial-tiny-text'`. */
  chipClassName?: string;
  /** Color overrides, applied as CSS custom properties. */
  colors?: AccessFieldColors;
}
