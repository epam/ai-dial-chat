import {
  mergeClasses,
  RESIZABLE_TEXTAREA_CLASS_NAME,
  TAG_INPUT_TAG_CLASS_NAME,
} from '@epam/ai-dial-chat-shared';
import {
  Input,
  TagInput,
  Textarea,
  TextareaResize,
} from '@epam/ai-dial-ui-kit';
import { useEffect, useRef, type FC } from 'react';
import type { DeploymentCreationFormProps } from '../../models/deployment-creation-form';
import {
  ALL_METADATA_FIELDS,
  MetadataField,
} from '../../models/metadata-field';
import { AddAvatar } from '../AddAvatar/AddAvatar';
import { DeploymentLocalesField } from '../DeploymentLocalesField/DeploymentLocalesField';

const DEFAULT_TOPICS_PLACEHOLDER = 'Add tags, comma separated';

/**
 * Controlled field set for deployment creation: avatar, name, version,
 * description, locales, and topics. `fields` narrows which ones render; the
 * order never changes.
 */
export const DeploymentCreationForm: FC<DeploymentCreationFormProps> = ({
  values,
  errors,
  onChange,
  onNameBlur,
  onVersionBlur,
  iconPreviewUrl,
  onAddAvatarClick,
  labels,
  styles,
  availableLocaleOptions = [],
  fields = ALL_METADATA_FIELDS,
  isNameReadOnly = false,
  nameCaption,
  isDescriptionRequired = false,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const hadErrorsRef = useRef(false);

  const shows = (field: MetadataField) => fields.includes(field);
  const showsName = shows(MetadataField.Name);
  const showsVersion = shows(MetadataField.Version);

  const hasErrors = !!(errors.name || errors.version || errors.description);

  /*
   * Only steal focus on the transition from no errors to some errors (a
   * submit attempt), not on every keystroke that adds/removes one field's
   * error while the user is still typing.
   */
  useEffect(() => {
    if (hasErrors && !hadErrorsRef.current) {
      if (errors.name) {
        nameInputRef.current?.focus();
      } else if (errors.version) {
        versionInputRef.current?.focus();
      } else if (errors.description) {
        descriptionRef.current?.focus();
      }
    }

    hadErrorsRef.current = hasErrors;
  }, [hasErrors, errors.name, errors.version, errors.description]);

  return (
    <div
      role={labels.ariaLabel ? 'group' : undefined}
      aria-label={labels.ariaLabel}
      className={mergeClasses('flex flex-col gap-4', styles?.root)}
    >
      {shows(MetadataField.Avatar) && (
        <AddAvatar
          label={labels.iconUrl.label}
          avatarUrl={iconPreviewUrl}
          addAvatarLabel={labels.iconUrl.addAvatarLabel}
          captionText={labels.iconUrl.captionText}
          onAddAvatarClick={onAddAvatarClick}
          className={styles?.field}
        />
      )}

      {(showsName || showsVersion) && (
        <div className={mergeClasses('flex items-start gap-4', styles?.field)}>
          {showsName && (
            <Input
              id="deployment-creation-form-name"
              inputRef={nameInputRef}
              value={values.name}
              onChange={(value) => onChange({ name: value ?? '' })}
              onBlur={onNameBlur}
              readOnly={isNameReadOnly}
              labelProps={{ label: labels.name.label, required: true }}
              placeholder={labels.name.placeholder}
              caption={nameCaption}
              error={errors.name || undefined}
              invalid={!!errors.name}
              containerClassName={
                showsVersion ? 'min-w-0 basis-0 grow-[2]' : 'min-w-0 flex-1'
              }
            />
          )}

          {showsVersion && (
            <Input
              id="deployment-creation-form-version"
              inputRef={versionInputRef}
              value={values.version}
              onChange={(value) => onChange({ version: value ?? '' })}
              onBlur={onVersionBlur}
              labelProps={{ label: labels.version.label }}
              placeholder={labels.version.placeholder}
              error={errors.version || undefined}
              invalid={!!errors.version}
              containerClassName={
                showsName ? 'min-w-0 basis-0 grow-[1]' : 'min-w-0 flex-1'
              }
            />
          )}
        </div>
      )}

      {shows(MetadataField.Description) && (
        <Textarea
          id="deployment-creation-form-description"
          ref={descriptionRef}
          value={values.description}
          onChange={(value) => onChange({ description: value })}
          labelProps={{
            label: labels.description.label,
            required: isDescriptionRequired,
          }}
          placeholder={labels.description.placeholder}
          error={errors.description || undefined}
          invalid={!!errors.description}
          containerClassName={styles?.field}
          className={RESIZABLE_TEXTAREA_CLASS_NAME}
          resize={TextareaResize.Vertical}
        />
      )}

      {shows(MetadataField.Locales) && (
        <DeploymentLocalesField
          value={values.otherLocales}
          onChange={(otherLocales) => onChange({ otherLocales })}
          availableLocaleOptions={availableLocaleOptions}
          labels={labels.otherLocales}
          className={styles?.field}
        />
      )}

      {shows(MetadataField.Tags) && (
        <div className={styles?.field}>
          <TagInput
            id="deployment-creation-form-topics"
            labelProps={{ label: labels.topics.label }}
            placeholder={
              labels.topics.placeholder ?? DEFAULT_TOPICS_PLACEHOLDER
            }
            value={values.topics}
            onChange={(topics) => onChange({ topics })}
            tagClassName={TAG_INPUT_TAG_CLASS_NAME}
          />
        </div>
      )}
    </div>
  );
};
