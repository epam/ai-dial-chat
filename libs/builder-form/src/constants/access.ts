import type { AccessFieldLabels } from '../models/access-field-props';

/** English defaults for the labels of `AccessField` and `AccessModal`. */
export const DEFAULT_ACCESS_FIELD_LABELS: AccessFieldLabels = {
  title: 'Access',
  description: 'What this app can reach. Shown to users before they install.',
  configureLabel: 'Configure',
  modalTitle: 'Access',
  selectContent: 'Select content',
  selectAccess: 'Select access',
  accessRead: 'Read',
  accessReadWrite: 'Read&Write',
  removeEntry: (entryLabel) => `Remove ${entryLabel}`,
  deleteCard: 'Delete access',
  announceAdded: (entryLabel) => `${entryLabel} added`,
  announceRemoved: (entryLabel) => `${entryLabel} removed`,
  cancelLabel: 'Cancel',
  saveLabel: 'Save',
  closeAriaLabel: 'Close dialog',
};
