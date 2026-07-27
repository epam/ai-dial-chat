import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  GhostButton,
  Input,
  NeutralButton,
  PrimaryButton,
  Textarea,
} from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialSegmentedControl,
  DialSwitch,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { type FC } from 'react';
import {
  DESCRIPTION_MAX_LENGTH,
  ScheduledTaskCreateFormProps,
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '../../models/scheduled-task-create-form-props';

/**
 * Presentational create-task form: display name, a one-shot/recurring
 * schedule section, a model picker, a prompt textarea, a stream toggle, and
 * Cancel/Create actions. Field values, validation errors, and model options
 * are all supplied by the host app; this component holds no state of its
 * own and performs no routing, i18n, or network calls.
 */
export const ScheduledTaskCreateForm: FC<ScheduledTaskCreateFormProps> = ({
  labels,
  values,
  errors,
  modelOptions,
  onFieldChange,
  onCancel,
  onSubmit,
  isSubmitting = false,
  styles: formStyles,
}) => {
  const containerClassName = formStyles?.containerClassName ?? 'bg-layer-5';
  const titleClassName = formStyles?.titleClassName ?? 'dial-h1-text';
  const scheduleSectionLabelClassName =
    formStyles?.scheduleSectionLabelClassName ?? 'dial-body-semi-text mb-1';

  const isCreateDisabled =
    isSubmitting ||
    !values.displayName.trim() ||
    !values.modelId ||
    !values.prompt.trim();

  const selectedModelLabel =
    modelOptions.find((option) => option.id === values.modelId)?.label ??
    labels.modelPlaceholder;
  const selectedFrequencyLabel =
    labels.frequencyOptions.find((option) => option.key === values.frequency)
      ?.label ?? labels.frequencyLabel;

  return (
    <div
      className={mergeClasses(
        'flex h-full w-full flex-col gap-6 overflow-y-auto px-8 py-4',
        containerClassName,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className={mergeClasses('truncate', titleClassName)}>
          {labels.pageTitle}
        </h1>
        <div className="flex items-center gap-2">
          <NeutralButton
            type="button"
            label={labels.cancelButtonLabel}
            onClick={onCancel}
            disabled={isSubmitting}
          />
          <PrimaryButton
            type="button"
            label={labels.createButtonLabel}
            onClick={onSubmit}
            disabled={isCreateDisabled}
          />
        </div>
      </div>

      <div className="flex max-w-xl flex-col gap-4">
        <Input
          id="scheduled-task-display-name"
          value={values.displayName}
          onChange={(value) => onFieldChange('displayName', value ?? '')}
          labelProps={{ label: labels.displayNameLabel, required: true }}
          invalid={Boolean(errors.displayName)}
          error={errors.displayName}
        />

        <Textarea
          id="scheduled-task-description"
          value={values.description ?? ''}
          onChange={(value) => onFieldChange('description', value)}
          labelProps={{ label: labels.descriptionLabel }}
          maxLength={DESCRIPTION_MAX_LENGTH}
          invalid={Boolean(errors.description)}
          error={errors.description}
          caption={
            values.description
              ? `${values.description.length}/${DESCRIPTION_MAX_LENGTH}`
              : undefined
          }
        />

        <fieldset className="flex flex-col gap-3">
          <legend className={scheduleSectionLabelClassName}>
            {labels.scheduleSectionLabel}
          </legend>

          <DialSegmentedControl
            ariaLabel={labels.scheduleTypeAriaLabel}
            value={values.scheduleType}
            onChange={(value) => onFieldChange('scheduleType', value)}
            options={[
              {
                value: ScheduledTaskScheduleType.Once,
                label: labels.scheduleTypeOnceLabel,
              },
              {
                value: ScheduledTaskScheduleType.Recurring,
                label: labels.scheduleTypeRecurringLabel,
              },
            ]}
          />

          {values.scheduleType === ScheduledTaskScheduleType.Once && (
            <Input
              id="scheduled-task-run-at"
              type="datetime-local"
              value={values.runAt ?? ''}
              onChange={(value) => onFieldChange('runAt', value ?? '')}
              labelProps={{ label: labels.runAtLabel, required: true }}
              invalid={Boolean(errors.runAt)}
              error={errors.runAt}
            />
          )}

          {values.scheduleType === ScheduledTaskScheduleType.Recurring && (
            <>
              <DialDropdown
                matchReferenceWidth={false}
                placement="bottom-start"
                items={labels.frequencyOptions.map((option) => ({
                  key: option.key,
                  label: (
                    <span className="flex w-full items-center justify-between gap-2">
                      {option.label}
                      {option.key === values.frequency && (
                        <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                      )}
                    </span>
                  ),
                  onClick: () => onFieldChange('frequency', option.key),
                }))}
              >
                <GhostButton
                  type="button"
                  label={selectedFrequencyLabel}
                  aria-label={labels.frequencyLabel}
                  iconAfter={
                    <IconChevronDown size={DIAL_ICON_SIZE.SM} aria-hidden />
                  }
                />
              </DialDropdown>

              <Input
                id="scheduled-task-time"
                type="time"
                value={values.time}
                onChange={(value) => onFieldChange('time', value ?? '')}
                labelProps={{ label: labels.timeLabel, required: true }}
                invalid={Boolean(errors.time)}
                error={errors.time}
              />

              {values.frequency === ScheduledTaskFrequency.Weekly && (
                <Input
                  id="scheduled-task-day-of-week"
                  value={values.dayOfWeek ?? ''}
                  onChange={(value) => onFieldChange('dayOfWeek', value ?? '')}
                  labelProps={{ label: labels.dayOfWeekLabel, required: true }}
                  invalid={Boolean(errors.dayOfWeek)}
                  error={errors.dayOfWeek}
                />
              )}

              {values.frequency === ScheduledTaskFrequency.Monthly && (
                <Input
                  id="scheduled-task-day-of-month"
                  value={values.dayOfMonth ?? ''}
                  onChange={(value) => onFieldChange('dayOfMonth', value ?? '')}
                  labelProps={{ label: labels.dayOfMonthLabel, required: true }}
                  invalid={Boolean(errors.dayOfMonth)}
                  error={errors.dayOfMonth}
                />
              )}
            </>
          )}
        </fieldset>

        <DialDropdown
          matchReferenceWidth={false}
          placement="bottom-start"
          items={modelOptions.map((option) => ({
            key: option.id,
            label: (
              <span className="flex w-full items-center justify-between gap-2">
                {option.label}
                {option.id === values.modelId && (
                  <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                )}
              </span>
            ),
            onClick: () => onFieldChange('modelId', option.id),
          }))}
        >
          <GhostButton
            type="button"
            label={selectedModelLabel}
            aria-label={labels.modelLabel}
            iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.SM} aria-hidden />}
          />
        </DialDropdown>

        <Textarea
          id="scheduled-task-prompt"
          value={values.prompt}
          onChange={(value) => onFieldChange('prompt', value)}
          labelProps={{ label: labels.promptLabel, required: true }}
          invalid={Boolean(errors.prompt)}
          error={errors.prompt}
        />

        <DialSwitch
          switchId="scheduled-task-stream"
          label={labels.streamLabel}
          isOn={values.stream}
          onChange={(value) => onFieldChange('stream', value)}
        />
      </div>
    </div>
  );
};
