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
import { ScheduledTaskCreateFormProps } from '../../models/scheduled-task-create-form-props';

/**
 * Presentational create-task form: display name, a one-shot/recurring
 * schedule section, a model picker, a prompt textarea, a stream toggle, and
 * Cancel/Create actions. Field values, validation errors, and model options
 * are all supplied by the host app; this component holds no state of its
 * own and performs no routing, i18n, or network calls.
 */
export const ScheduledTaskCreateForm: FC<ScheduledTaskCreateFormProps> = ({
  texts,
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
    texts.modelPlaceholder;
  const selectedFrequencyLabel =
    texts.frequencyOptions.find((option) => option.key === values.frequency)
      ?.label ?? texts.frequencyLabel;

  return (
    <div
      className={mergeClasses(
        'flex h-full w-full flex-col gap-6 overflow-y-auto px-8 py-4',
        containerClassName,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className={mergeClasses('truncate', titleClassName)}>
          {texts.pageTitle}
        </h1>
        <div className="flex items-center gap-2">
          <NeutralButton
            type="button"
            label={texts.cancelButtonLabel}
            onClick={onCancel}
            disabled={isSubmitting}
          />
          <PrimaryButton
            type="button"
            label={texts.createButtonLabel}
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
          labelProps={{ label: texts.displayNameLabel, required: true }}
          invalid={Boolean(errors.displayName)}
          error={errors.displayName}
        />

        <fieldset className="flex flex-col gap-3">
          <legend className={scheduleSectionLabelClassName}>
            {texts.scheduleSectionLabel}
          </legend>

          <DialSegmentedControl
            ariaLabel={texts.scheduleTypeAriaLabel}
            value={values.scheduleType}
            onChange={(value) => onFieldChange('scheduleType', value)}
            options={[
              { value: 'once', label: texts.scheduleTypeOnceLabel },
              { value: 'recurring', label: texts.scheduleTypeRecurringLabel },
            ]}
          />

          {values.scheduleType === 'once' && (
            <Input
              id="scheduled-task-run-at"
              type="datetime-local"
              value={values.runAt ?? ''}
              onChange={(value) => onFieldChange('runAt', value ?? '')}
              labelProps={{ label: texts.runAtLabel, required: true }}
              invalid={Boolean(errors.runAt)}
              error={errors.runAt}
            />
          )}

          {values.scheduleType === 'recurring' && (
            <>
              <DialDropdown
                matchReferenceWidth={false}
                placement="bottom-start"
                items={texts.frequencyOptions.map((option) => ({
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
                  aria-label={texts.frequencyLabel}
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
                labelProps={{ label: texts.timeLabel, required: true }}
                invalid={Boolean(errors.time)}
                error={errors.time}
              />

              {values.frequency === 'weekly' && (
                <Input
                  id="scheduled-task-day-of-week"
                  value={values.dayOfWeek ?? ''}
                  onChange={(value) => onFieldChange('dayOfWeek', value ?? '')}
                  labelProps={{ label: texts.dayOfWeekLabel, required: true }}
                  invalid={Boolean(errors.dayOfWeek)}
                  error={errors.dayOfWeek}
                />
              )}

              {values.frequency === 'monthly' && (
                <Input
                  id="scheduled-task-day-of-month"
                  value={values.dayOfMonth ?? ''}
                  onChange={(value) => onFieldChange('dayOfMonth', value ?? '')}
                  labelProps={{ label: texts.dayOfMonthLabel, required: true }}
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
            aria-label={texts.modelLabel}
            iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.SM} aria-hidden />}
          />
        </DialDropdown>

        <Textarea
          id="scheduled-task-prompt"
          value={values.prompt}
          onChange={(value) => onFieldChange('prompt', value)}
          labelProps={{ label: texts.promptLabel, required: true }}
          invalid={Boolean(errors.prompt)}
          error={errors.prompt}
        />

        <DialSwitch
          switchId="scheduled-task-stream"
          label={texts.streamLabel}
          isOn={values.stream}
          onChange={(value) => onFieldChange('stream', value)}
        />
      </div>
    </div>
  );
};
