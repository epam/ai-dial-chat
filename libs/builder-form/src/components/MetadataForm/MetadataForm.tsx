import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import {
  DEFAULT_AVATAR_PICKER_LABELS,
  DEFAULT_METADATA_FORM_LABELS,
} from '../../constants/metadata-form';
import {
  ALL_METADATA_FIELDS,
  MetadataField,
} from '../../models/metadata-field';
import type { MetadataFormProps } from '../../models/metadata-form-props';
import { AvatarPickerModal } from '../AvatarPickerModal/AvatarPickerModal';
import { DeploymentCreationForm } from '../DeploymentCreationForm/DeploymentCreationForm';

/** Metadata field set shared by every entity editor, with a host-wired avatar picker. */
const MetadataFormComponent: FC<MetadataFormProps> = ({
  values,
  errors,
  onChange,
  onNameBlur,
  onVersionBlur,
  avatarPicker,
  availableLocaleOptions,
  fields = ALL_METADATA_FIELDS,
  isNameReadOnly,
  nameCaption,
  isDescriptionRequired,
  labels,
}) => {
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Without host wiring the avatar button could not open anything, so drop the field.
  const renderedFields = useMemo(
    () =>
      avatarPicker
        ? fields
        : fields.filter((field) => field !== MetadataField.Avatar),
    [avatarPicker, fields],
  );

  const iconUrl = values.iconUrl;
  const resolveIconUrl = avatarPicker?.resolveIconUrl;
  const iconPreviewUrl = useMemo(
    () => (resolveIconUrl ? resolveIconUrl(iconUrl) : undefined),
    [iconUrl, resolveIconUrl],
  );

  const handleAvatarPickerOpen = useCallback(
    () => setIsAvatarPickerOpen(true),
    [],
  );
  const handleAvatarPickerClose = useCallback(
    () => setIsAvatarPickerOpen(false),
    [],
  );

  const resolveAttachedIconUrl = avatarPicker?.resolveAttachedIconUrl;
  const handleAvatarAttach = useCallback(
    (result: AttachResult) => {
      const nextIconUrl = resolveAttachedIconUrl?.(result);
      if (nextIconUrl) {
        onChange({ iconUrl: nextIconUrl });
      }
      setIsAvatarPickerOpen(false);
    },
    [onChange, resolveAttachedIconUrl],
  );

  return (
    <>
      <DeploymentCreationForm
        values={values}
        errors={errors}
        onChange={onChange}
        onNameBlur={onNameBlur}
        onVersionBlur={onVersionBlur}
        iconPreviewUrl={iconPreviewUrl}
        onAddAvatarClick={handleAvatarPickerOpen}
        labels={labels?.form ?? DEFAULT_METADATA_FORM_LABELS}
        availableLocaleOptions={availableLocaleOptions}
        fields={renderedFields}
        isNameReadOnly={isNameReadOnly}
        nameCaption={nameCaption}
        isDescriptionRequired={isDescriptionRequired}
      />
      {avatarPicker && (
        <AvatarPickerModal
          isOpen={isAvatarPickerOpen}
          onClose={handleAvatarPickerClose}
          onAttach={handleAvatarAttach}
          bucket={avatarPicker.bucket}
          FileManagerModal={avatarPicker.FileManagerModal}
          allowedMimeTypes={avatarPicker.allowedMimeTypes}
          maxFileSizeBytes={avatarPicker.maxFileSizeBytes}
          labels={labels?.avatarPicker ?? DEFAULT_AVATAR_PICKER_LABELS}
        />
      )}
    </>
  );
};

/** Metadata field set shared by every entity editor, with a host-wired avatar picker. */
export const MetadataForm = memo(MetadataFormComponent);
