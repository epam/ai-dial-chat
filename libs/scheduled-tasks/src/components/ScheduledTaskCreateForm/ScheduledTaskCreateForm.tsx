import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { Input, Textarea } from '@epam/ai-dial-ui-kit';
import {
  Calendar,
  CalendarMode,
  DIAL_ICON_SIZE,
  GhostIconButton,
  DialSelectField,
  Spinner,
  LazyDialMarkdownEditor,
  NeutralButton,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import { lazy, Suspense, type ComponentProps, type FC } from 'react';
import { DESCRIPTION_MAX_LENGTH } from '../../constants/scheduled-task-create-form';
import { ScheduledTaskCreateFormProps } from '../../models/scheduled-task-create-form-props';
import {
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '../../types/scheduled-task-schedule';
import {
  calendarValueToDateValue,
  calendarValueToDayOfWeek,
  calendarValueToRunAt,
  dateValueToCalendarValue,
  dayOfWeekToCalendarValue,
  runAtToCalendarValue,
} from '../../utils/calendar-value';
import styles from './ScheduledTaskCreateForm.module.scss';

/* `Calendar` has no built-in required-field indicator (unlike `Input`'s
 * `labelProps.required`), so required Calendar fields get the marker
 * appended to their label text directly. */
const withRequiredMarker = (label: string): string => `${label} *`;

const DialMarkdownEditor = lazy(async () => {
  const module = await LazyDialMarkdownEditor();
  return { default: module.DialMarkdownEditor };
});

type DialMarkdownEditorTheme = ComponentProps<
  typeof DialMarkdownEditor
>['theme'];

/**
 * Presentational create-task form: a back-navigable header (Cancel/Save
 * actions) and a two-column Details/Configuration body. Details holds
 * display name, description, the schedule fields, and the model picker;
 * Configuration holds the markdown Instructions editor. Field values,
 * validation errors, and model options are all supplied by the host app;
 * this component holds no state of its own and performs no routing, i18n,
 * or network calls.
 */
export const ScheduledTaskCreateForm: FC<ScheduledTaskCreateFormProps> = ({
  labels,
  values,
  errors,
  modelOptions,
  onFieldChange,
  onBack,
  onCancel,
  onSubmit,
  isSubmitting = false,
  markdownEditorTheme,
  styles: formStyles,
}) => {
  const { colors, typography } = formStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const sectionTitleClassName =
    typography?.sectionTitleClassName ?? 'dial-body-semi-text';
  const sectionSubtitleClassName =
    typography?.sectionSubtitleClassName ?? 'dial-tiny-text';
  const scheduleSectionLabelClassName =
    typography?.scheduleSectionLabelClassName ?? 'dial-body-semi-text mb-1';
  const instructionsErrorClassName =
    typography?.instructionsErrorClassName ?? 'dial-small-text';
  const cssVars = buildCssVars({
    '--stcf-bg': colors?.background,
    '--stcf-header-border': colors?.headerBorder,
    '--stcf-details-border': colors?.detailsColumnBorder,
    '--stcf-subtitle-text': colors?.sectionSubtitleText,
    '--stcf-error-text': colors?.instructionsErrorText,
  });

  const isCreateDisabled =
    isSubmitting ||
    !values.displayName.trim() ||
    !values.modelId ||
    !values.prompt.trim();

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex h-full w-full flex-col overflow-y-auto',
        styles.container,
      )}
    >
      <div
        className={mergeClasses(
          'flex h-16 items-center justify-between gap-6 border-b px-8',
          styles.header,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GhostIconButton
            icon={
              <IconArrowLeft
                size={DIAL_ICON_SIZE.LG}
                className="rtl:scale-x-[-1]"
                aria-hidden
              />
            }
            aria-label={labels.backButtonLabel}
            onClick={onBack}
          />
          <h1 className={mergeClasses('truncate', titleClassName)}>
            {labels.pageTitle}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <NeutralButton
            label={labels.cancelButtonLabel}
            onClick={onCancel}
            disabled={isSubmitting}
          />
          <PrimaryButton
            label={labels.createButtonLabel}
            onClick={onSubmit}
            disabled={isCreateDisabled}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col desktop:flex-row">
        <div
          role="group"
          aria-label={labels.detailsSectionTitle}
          className={mergeClasses(
            'flex w-full flex-col gap-5 border-e px-8 py-6 desktop:w-[360px] desktop:shrink-0',
            styles.detailsColumn,
          )}
        >
          <div className="flex flex-col gap-1">
            <h2 className={sectionTitleClassName}>
              {labels.detailsSectionTitle}
            </h2>
            <p
              className={mergeClasses(
                sectionSubtitleClassName,
                styles.sectionSubtitle,
              )}
            >
              {labels.detailsSectionSubtitle}
            </p>
          </div>

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

          <DialSelectField
            label={labels.modelOrAgentLabel}
            required
            value={values.modelId}
            placeholder={labels.modelPlaceholder}
            onChange={(next) => onFieldChange('modelId', next as string)}
            error={errors.modelId}
            options={modelOptions.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
          />

          <fieldset className="flex flex-col gap-3">
            <legend className={scheduleSectionLabelClassName}>
              {labels.scheduleSectionLabel}
            </legend>

            <DialSelectField
              label={labels.scheduleTypeAriaLabel}
              value={values.scheduleType}
              onChange={(next) =>
                onFieldChange('scheduleType', next as ScheduledTaskScheduleType)
              }
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
              <div className="flex flex-col gap-1">
                <Calendar
                  id="scheduled-task-run-at"
                  mode={CalendarMode.DateTime}
                  value={runAtToCalendarValue(values.runAt)}
                  onChange={(value) =>
                    onFieldChange('runAt', calendarValueToRunAt(value))
                  }
                  label={withRequiredMarker(labels.runAtLabel)}
                  invalid={Boolean(errors.runAt)}
                />
                {errors.runAt && (
                  <p
                    className={mergeClasses(
                      instructionsErrorClassName,
                      styles.instructionsError,
                    )}
                  >
                    {errors.runAt}
                  </p>
                )}
              </div>
            )}

            {values.scheduleType === ScheduledTaskScheduleType.Recurring && (
              <>
                <DialSelectField
                  label={labels.frequencyLabel}
                  value={values.frequency}
                  onChange={(next) =>
                    onFieldChange('frequency', next as ScheduledTaskFrequency)
                  }
                  options={labels.frequencyOptions.map((option) => ({
                    value: option.key,
                    label: option.label,
                  }))}
                />

                <div className="flex flex-col gap-1">
                  <Calendar
                    id="scheduled-task-time"
                    mode={CalendarMode.Time}
                    value={values.time}
                    onChange={(value) =>
                      onFieldChange(
                        'time',
                        typeof value === 'string' ? value : '',
                      )
                    }
                    label={withRequiredMarker(labels.timeLabel)}
                    invalid={Boolean(errors.time)}
                  />
                  {errors.time && (
                    <p
                      className={mergeClasses(
                        instructionsErrorClassName,
                        styles.instructionsError,
                      )}
                    >
                      {errors.time}
                    </p>
                  )}
                </div>

                {values.frequency === ScheduledTaskFrequency.Weekly && (
                  <div className="flex flex-col gap-1">
                    <Calendar
                      id="scheduled-task-day-of-week"
                      mode={CalendarMode.Weekday}
                      value={dayOfWeekToCalendarValue(values.dayOfWeek)}
                      onChange={(value) =>
                        onFieldChange(
                          'dayOfWeek',
                          calendarValueToDayOfWeek(value),
                        )
                      }
                      label={withRequiredMarker(labels.dayOfWeekLabel)}
                      invalid={Boolean(errors.dayOfWeek)}
                    />
                    {errors.dayOfWeek && (
                      <p
                        className={mergeClasses(
                          instructionsErrorClassName,
                          styles.instructionsError,
                        )}
                      >
                        {errors.dayOfWeek}
                      </p>
                    )}
                  </div>
                )}

                {values.frequency === ScheduledTaskFrequency.Monthly && (
                  <Input
                    id="scheduled-task-day-of-month"
                    value={values.dayOfMonth ?? ''}
                    onChange={(value) =>
                      onFieldChange('dayOfMonth', value ?? '')
                    }
                    labelProps={{
                      label: labels.dayOfMonthLabel,
                      required: true,
                    }}
                    invalid={Boolean(errors.dayOfMonth)}
                    error={errors.dayOfMonth}
                  />
                )}

                <div className="flex flex-col gap-3 desktop:flex-row">
                  <div className="flex flex-1 flex-col gap-1">
                    <Calendar
                      id="scheduled-task-start-date"
                      mode={CalendarMode.Date}
                      value={dateValueToCalendarValue(values.startDate)}
                      onChange={(value) =>
                        onFieldChange(
                          'startDate',
                          calendarValueToDateValue(value),
                        )
                      }
                      label={labels.startDateLabel}
                      placeholder={labels.startDatePlaceholder}
                      invalid={Boolean(errors.startDate)}
                    />
                    {errors.startDate && (
                      <p
                        className={mergeClasses(
                          instructionsErrorClassName,
                          styles.instructionsError,
                        )}
                      >
                        {errors.startDate}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1">
                    <Calendar
                      id="scheduled-task-end-date"
                      mode={CalendarMode.Date}
                      value={dateValueToCalendarValue(values.endDate)}
                      onChange={(value) =>
                        onFieldChange(
                          'endDate',
                          calendarValueToDateValue(value),
                        )
                      }
                      label={labels.endDateLabel}
                      placeholder={labels.endDatePlaceholder}
                      invalid={Boolean(errors.endDate)}
                    />
                    {errors.endDate && (
                      <p
                        className={mergeClasses(
                          instructionsErrorClassName,
                          styles.instructionsError,
                        )}
                      >
                        {errors.endDate}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </fieldset>
        </div>

        <div
          role="group"
          aria-label={labels.configurationSectionTitle}
          className="flex w-full min-w-0 flex-1 flex-col gap-5 px-8 py-6"
        >
          <div className="flex flex-col gap-1">
            <h2 className={sectionTitleClassName}>
              {labels.configurationSectionTitle}
            </h2>
            <p
              className={mergeClasses(
                sectionSubtitleClassName,
                styles.sectionSubtitle,
              )}
            >
              {labels.configurationSectionSubtitle}
            </p>
          </div>

          <div
            role="group"
            aria-label={labels.instructionsLabel}
            className="flex flex-1 flex-col gap-1"
          >
            <span className={scheduleSectionLabelClassName}>
              {labels.instructionsLabel}
            </span>
            <Suspense fallback={<Spinner />}>
              <DialMarkdownEditor
                value={values.prompt}
                onChange={(value) => onFieldChange('prompt', value)}
                height={480}
                theme={markdownEditorTheme as DialMarkdownEditorTheme}
              />
            </Suspense>
            {errors.prompt && (
              <p
                className={mergeClasses(
                  instructionsErrorClassName,
                  styles.instructionsError,
                )}
              >
                {errors.prompt}
              </p>
            )}
          </div>
        </div>

        <div
          aria-hidden
          className="hidden desktop:block desktop:w-[360px] desktop:shrink-0"
        />
      </div>
    </div>
  );
};
