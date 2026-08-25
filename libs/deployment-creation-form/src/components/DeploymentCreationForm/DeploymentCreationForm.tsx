import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Input, TagInput, Textarea } from '@epam/ai-dial-ui-kit';
import { useEffect, useRef, type FC } from 'react';
import type { DeploymentCreationFormProps } from '../../models/deployment-creation-form';
import { DeploymentLocalesField } from '../DeploymentLocalesField/DeploymentLocalesField';

/** Controlled field set for deployment creation: name, description, icon URL, version, and topics. */
export const DeploymentCreationForm: FC<DeploymentCreationFormProps> = ({
  values,
  errors,
  onChange,
  onNameBlur,
  onVersionBlur,
  labels,
  styles,
  availableLocaleOptions = [],
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const hadErrorsRef = useRef(false);

  const hasErrors = !!(errors.name || errors.version);

  /*
   * Only steal focus on the transition from no errors to some errors (a
   * submit attempt), not on every keystroke that adds/removes one field's
   * error while the user is still typing.
   */
  useEffect(() => {
    if (hasErrors && !hadErrorsRef.current) {
      const firstInvalidRef = errors.name ? nameInputRef : versionInputRef;

      firstInvalidRef.current?.focus();
    }

    hadErrorsRef.current = hasErrors;
  }, [hasErrors, errors.name, errors.version]);

  return (
    <div
      role={labels.ariaLabel ? 'group' : undefined}
      aria-label={labels.ariaLabel}
      className={mergeClasses('flex flex-col gap-4', styles?.root)}
    >
      <Input
        id="deployment-creation-form-name"
        inputRef={nameInputRef}
        value={values.name}
        onChange={(value) => onChange({ name: value ?? '' })}
        onBlur={onNameBlur}
        labelProps={{ label: labels.name.label, required: true }}
        placeholder={labels.name.placeholder}
        error={errors.name || undefined}
        invalid={!!errors.name}
        containerClassName={styles?.field}
      />

      <Textarea
        id="deployment-creation-form-description"
        value={values.description}
        onChange={(value) => onChange({ description: value })}
        labelProps={{ label: labels.description.label }}
        placeholder={labels.description.placeholder}
        containerClassName={styles?.field}
      />

      <DeploymentLocalesField
        value={values.otherLocales}
        onChange={(otherLocales) => onChange({ otherLocales })}
        availableLocaleOptions={availableLocaleOptions}
        labels={labels.otherLocales}
        className={styles?.field}
      />

      <Input
        id="deployment-creation-form-icon-url"
        value={values.iconUrl}
        onChange={(value) => onChange({ iconUrl: value ?? '' })}
        labelProps={{ label: labels.iconUrl.label }}
        placeholder={labels.iconUrl.placeholder}
        containerClassName={styles?.field}
      />

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
        containerClassName={styles?.field}
      />

      <div className={styles?.field}>
        <TagInput
          id="deployment-creation-form-topics"
          labelProps={{ label: labels.topics.label }}
          placeholder={labels.topics.placeholder}
          value={values.topics}
          onChange={(topics) => onChange({ topics })}
        />
      </div>
    </div>
  );
};
