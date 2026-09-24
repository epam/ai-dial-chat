import type {
  DeploymentCreationFormLabels,
  MetadataFormAvatarPicker,
} from '@epam/ai-dial-builder-form';
import { MetadataForm } from '@epam/ai-dial-builder-form';
import { dialFileToAttachment } from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { useCallback, useMemo } from 'react';
import type { GeneralFormProps } from '../../models/general-form-props';

/* Toolset-flavoured English defaults applied when the host omits the form labels group. */
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

/**
 * General (metadata) form shared by the Toolset and Custom App editors.
 * @deprecated Render `MetadataForm` from `@epam/ai-dial-builder-form` and supply `avatarPicker.resolveAttachedIconUrl` instead.
 */
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
  const resolveAttachedIconUrl = useCallback(
    (result: AttachResult) => {
      const [file] = result.files;
      const attachment = file
        ? dialFileToAttachment(file, bucket, {
            resolvePreviewUrl: resolveIconUrl,
          })
        : null;

      return attachment?.url;
    },
    [bucket, resolveIconUrl],
  );

  const avatarPicker = useMemo<MetadataFormAvatarPicker>(
    () => ({
      bucket,
      FileManagerModal,
      resolveIconUrl,
      resolveAttachedIconUrl,
      allowedMimeTypes,
      maxFileSizeBytes,
    }),
    [
      bucket,
      FileManagerModal,
      resolveIconUrl,
      resolveAttachedIconUrl,
      allowedMimeTypes,
      maxFileSizeBytes,
    ],
  );

  const metadataLabels = useMemo(
    () => ({
      form: labels?.form ?? DEFAULT_FORM_LABELS,
      avatarPicker: labels?.avatarPicker,
    }),
    [labels?.form, labels?.avatarPicker],
  );

  return (
    <MetadataForm
      values={form}
      errors={errors}
      onChange={onChange}
      onNameBlur={onNameBlur}
      onVersionBlur={onVersionBlur}
      avatarPicker={avatarPicker}
      availableLocaleOptions={availableLocaleOptions}
      labels={metadataLabels}
    />
  );
};
