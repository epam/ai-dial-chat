import type {
  AvatarPickerModalLabels,
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
} from '@epam/ai-dial-builder-form';
import {
  AvatarPickerModal,
  DeploymentCreationForm,
} from '@epam/ai-dial-builder-form';
import { dialFileToAttachment } from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { useMemo, useState } from 'react';
import type { GeneralFormProps } from '../../models/general-form-props';

/* English defaults applied when the host omits the corresponding labels group. */
const DEFAULT_FORM_LABELS: DeploymentCreationFormLabels = {
  name: { label: 'Name', placeholder: 'Enter name' },
  description: {
    label: 'Description',
    placeholder: 'Describe what this toolset does',
  },
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
  ariaLabel: 'General',
};

/* English defaults applied when the host omits the avatar-picker labels group. */
const DEFAULT_AVATAR_PICKER_LABELS: AvatarPickerModalLabels = {
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

/** General (metadata) form shared by the Toolset and Custom App editors: name, description, avatar, version, tags, and additional locales. */
export const GeneralForm: FC<GeneralFormProps> = ({
  form,
  errors,
  bucket,
  FileManagerModal,
  resolveIconUrl,
  allowedMimeTypes,
  maxFileSizeBytes,
  availableLocaleOptions,
  onChange,
  onNameBlur,
  onVersionBlur,
  labels,
}) => {
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const formLabels: DeploymentCreationFormLabels =
    labels?.form ?? DEFAULT_FORM_LABELS;
  const avatarPickerLabels: AvatarPickerModalLabels =
    labels?.avatarPicker ?? DEFAULT_AVATAR_PICKER_LABELS;

  const iconPreviewUrl = useMemo(
    () => resolveIconUrl(form.iconUrl),
    [form.iconUrl, resolveIconUrl],
  );

  const values: DeploymentCreationFormValues = {
    name: form.name,
    description: form.description,
    iconUrl: form.iconUrl,
    version: form.version,
    topics: form.topics,
    otherLocales: form.otherLocales,
  };

  return (
    <>
      <DeploymentCreationForm
        values={values}
        errors={errors}
        onChange={onChange}
        onNameBlur={onNameBlur}
        onVersionBlur={onVersionBlur}
        iconPreviewUrl={iconPreviewUrl}
        onAddAvatarClick={() => setIsAvatarPickerOpen(true)}
        labels={formLabels}
        availableLocaleOptions={availableLocaleOptions}
      />
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        onAttach={(result: AttachResult) => {
          const [file] = result.files;
          const attachment = file
            ? dialFileToAttachment(file, bucket, {
                resolvePreviewUrl: resolveIconUrl,
              })
            : null;
          if (attachment?.url) {
            onChange({ iconUrl: attachment.url });
          }
          setIsAvatarPickerOpen(false);
        }}
        bucket={bucket}
        FileManagerModal={FileManagerModal}
        allowedMimeTypes={allowedMimeTypes}
        maxFileSizeBytes={maxFileSizeBytes}
        labels={avatarPickerLabels}
      />
    </>
  );
};
