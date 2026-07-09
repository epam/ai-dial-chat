import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Input, TagInput, Textarea } from '@epam/ai-dial-kit';
import type { FC } from 'react';
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
}) => (
  <div className={mergeClasses('flex flex-col gap-4', classNames?.root)}>
    <Input
      id="deployment-creation-form-name"
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
      value={values.intro}
      onChange={(value) => onChange({ intro: value ?? '' })}
      labelProps={{ label: labels.intro.label }}
      placeholder={labels.intro.placeholder}
      error={errors.intro || undefined}
      invalid={!!errors.intro}
      maxLength={introMaxLength}
      containerClassName={classNames?.field}
    />

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
