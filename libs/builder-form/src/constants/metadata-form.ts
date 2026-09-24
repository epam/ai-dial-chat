import type { AvatarPickerModalLabels } from '../models/avatar-picker-modal';
import type { DeploymentCreationFormLabels } from '../models/deployment-creation-form';

/** English defaults `MetadataForm` uses when the host omits the form labels group. */
export const DEFAULT_METADATA_FORM_LABELS: DeploymentCreationFormLabels = {
  name: { label: 'Name', placeholder: 'Enter name' },
  description: { label: 'Description', placeholder: 'Enter description' },
  iconUrl: {
    label: 'Avatar',
    addAvatarLabel: 'Add avatar',
    captionText: 'PNG, JPG or SVG (max 1 MB)',
  },
  version: { label: 'Version', placeholder: 'e.g. 1.0.0' },
  topics: { label: 'Tags', placeholder: 'Add tags, comma separated' },
  otherLocales: {
    summaryLabel: 'Locales',
    addLabel: 'Add locales',
    editLabel: 'Edit locales',
    popupTitle: 'Add locale',
    addLocaleLabel: 'Add locale',
    localeRowLabel: 'Locale',
    languageLabel: 'Language',
    nameLabel: 'Name',
    namePlaceholder: 'Enter name',
    descriptionLabel: 'About',
    descriptionPlaceholder: 'Enter brief description',
    deleteAriaLabel: 'Delete locale',
    cancelLabel: 'Cancel',
    saveLabel: 'Save',
  },
  ariaLabel: 'Metadata',
};

/** English defaults `MetadataForm` uses when the host omits the avatar-picker labels group. */
export const DEFAULT_AVATAR_PICKER_LABELS: AvatarPickerModalLabels = {
  title: 'Add avatar',
  attachLabel: 'Attach',
  emptyTitle: 'This folder is empty',
  emptyDescription: '',
  errorMessage: 'Failed to load files',
  retryLabel: 'Retry',
  hiddenFilesLabel: 'Hidden files',
  showHiddenFilesLabel: 'Show hidden files',
  hideHiddenFilesLabel: 'Hide hidden files',
  getSelectionLabel: (count: number) =>
    count === 1 ? `${count} item selected` : `${count} items selected`,
  uploadFilesLabel: 'Upload files',
  newFolderLabel: 'New folder',
  downloadLabel: 'Download',
  downloadingLabel: 'Preparing download…',
  deleteLabel: 'Delete',
  deletingLabel: 'Deleting…',
  deleteConfirmTitleSingle: 'Confirm deleting',
  deleteConfirmTitleMultiple: 'Confirm deleting items',
  deleteConfirmSingleText: 'Are you sure you want to delete',
  deleteConfirmMultipleText: 'Do you want to delete following',
  deleteConfirmItemsLabel: 'items?',
  deleteConfirmLabel: 'Delete',
  deleteCancelLabel: 'Cancel',
  uploadProgressTitle: 'Uploading files',
  cancelLabel: 'Cancel',
};
