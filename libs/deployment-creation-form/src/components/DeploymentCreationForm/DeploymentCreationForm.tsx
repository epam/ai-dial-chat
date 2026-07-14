import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Input, TagInput, Textarea } from '@epam/ai-dial-kit';
import { useEffect, useRef, type FC } from 'react';
import type { DeploymentCreationFormProps } from '../../models/deployment-creation-form';
import { DEFAULT_INTRO_MAX_LENGTH } from '../../utils/validate-deployment-creation-fields';

/**
 * Controlled presentation component for the field set shared by Quick App and
 * Toolset creation: name, description, icon URL, version, topics, and intro.
 * Holds no field state of its own, performs no validation, and makes no
 * network calls — the host app owns values, errors, and submission.
 */
export const DeploymentCreationForm: FC<DeploymentCreationFormProps> = ({
  values,
  errors,
  onChange,
  labels,
  introMaxLength = DEFAULT_INTRO_MAX_LENGTH,
  classNames,
  ariaLabel,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const introInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const hadErrorsRef = useRef(false);

  const hasErrors = !!(errors.name || errors.intro || errors.version);

  /*
   * Only steal focus on the transition from no errors to some errors (a
   * submit attempt), not on every keystroke that adds/removes one field's
   * error while the user is still typing.
   */
  useEffect(() => {
    if (hasErrors && !hadErrorsRef.current) {
      const firstInvalidRef = errors.name
        ? nameInputRef
        : errors.intro
          ? introInputRef
          : versionInputRef;

      firstInvalidRef.current?.focus();
    }

    hadErrorsRef.current = hasErrors;
  }, [hasErrors, errors.name, errors.intro, errors.version]);

  return (
    <div
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      className={mergeClasses('flex flex-col gap-4', classNames?.root)}
    >
      <Input
        id="deployment-creation-form-name"
        inputRef={nameInputRef}
        value={values.name}
        onChange={(value) => onChange({ name: value ?? '' })}
        labelProps={{ label: labels.name.label, required: true }}
        placeholder={labels.name.placeholder}
        error={errors.name || undefined}
        invalid={!!errors.name}
        containerClassName={classNames?.field}
      />

      <Textarea
        id="deployment-creation-form-description"
        value={values.description}
        onChange={(value) => onChange({ description: value })}
        labelProps={{ label: labels.description.label }}
        placeholder={labels.description.placeholder}
        containerClassName={classNames?.field}
      />

      <Input
        id="deployment-creation-form-intro"
        inputRef={introInputRef}
        value={values.intro}
        onChange={(value) => onChange({ intro: value ?? '' })}
        labelProps={{ label: labels.intro.label }}
        placeholder={labels.intro.placeholder}
        error={errors.intro || undefined}
        invalid={!!errors.intro}
        maxLength={introMaxLength}
        containerClassName={classNames?.field}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {values.intro.length >= introMaxLength - 10 &&
          `${values.intro.length}/${introMaxLength}`}
      </span>

      <Input
        id="deployment-creation-form-icon-url"
        value={values.iconUrl}
        onChange={(value) => onChange({ iconUrl: value ?? '' })}
        labelProps={{ label: labels.iconUrl.label }}
        placeholder={labels.iconUrl.placeholder}
        containerClassName={classNames?.field}
      />

      <Input
        id="deployment-creation-form-version"
        inputRef={versionInputRef}
        value={values.version}
        onChange={(value) => onChange({ version: value ?? '' })}
        labelProps={{ label: labels.version.label }}
        placeholder={labels.version.placeholder}
        error={errors.version || undefined}
        invalid={!!errors.version}
        containerClassName={classNames?.field}
      />

      <div className={classNames?.field}>
        <TagInput
          elementId="deployment-creation-form-topics"
          label={labels.topics.label}
          placeholder={labels.topics.placeholder}
          initialTags={values.topics}
          onChange={(topics) => onChange({ topics })}
        />
      </div>
    </div>
  );
};
