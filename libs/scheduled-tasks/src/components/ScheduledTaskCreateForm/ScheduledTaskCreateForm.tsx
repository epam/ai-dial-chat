import { BuilderFormContainer } from '@epam/ai-dial-builder-form';
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Input,
  Textarea,
  Calendar,
  CalendarMode,
  Label,
  NumberInput,
  Spinner,
  LazyMarkdownEditor,
  Select,
} from '@epam/ai-dial-ui-kit';
import { lazy, Suspense, type ComponentProps, type FC } from 'react';
import { DESCRIPTION_MAX_LENGTH } from '../../constants/scheduled-task-create-form';
import { ScheduledTaskCreateFormProps } from '../../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../../types/scheduled-task-schedule';
import {
  calendarValueToDateValue,
  calendarValueToDayOfWeek,
  calendarValueToRunAt,
  dateValueToCalendarValue,
  dayOfWeekToCalendarValue,
  runAtToCalendarValue,
} from '../../utils/calendar-value';
import styles from './ScheduledTaskCreateForm.module.scss';

const MarkdownEditor = lazy(async () => {
  const module = await LazyMarkdownEditor();
  return { default: module.MarkdownEditor };
});

type MarkdownEditorTheme = ComponentProps<typeof MarkdownEditor>['theme'];

/**
 * Presentational create-task form: a back-navigable header (Cancel/Save
 * actions) and a two-column Details/Configuration body. Details holds
 * display name, description, the schedule fields, and the Model or Agent
 * field; Configuration holds the markdown Instructions editor. Field values
 * and validation errors are supplied by the host app, and the Model or
 * Agent field's control is a fully-composed `modelSelector` element the host
 * renders; this component holds no state of its own and performs no
 * routing, i18n, or network calls.
 */
export const ScheduledTaskCreateForm: FC<ScheduledTaskCreateFormProps> = ({
  labels,
  values,
  errors,
  modelSelector,
  modelLabelId,
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
  const instructionsLabelClassName =
    typography?.instructionsLabelClassName ?? 'dial-body-semi-text mb-1';
  const instructionsErrorClassName =
    typography?.instructionsErrorClassName ?? 'dial-small-text';
  const cssVars = buildCssVars({
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
    <BuilderFormContainer
      labels={{
        title: labels.pageTitle,
        backButtonLabel: labels.backButtonLabel,
        cancelButtonLabel: labels.cancelButtonLabel,
        submitButtonLabel: labels.createButtonLabel,
      }}
      onBack={onBack}
      onCancel={onCancel}
      onSubmit={onSubmit}
      isCancelDisabled={isSubmitting}
      isSubmitDisabled={isCreateDisabled}
      styles={{
        colors: { background: colors?.background },
        header: {
          colors: { borderColor: colors?.headerBorder },
          typography: { fontClassName: titleClassName },
        },
        cssVars,
      }}
      left={
        <div
          role="group"
          aria-label={labels.detailsSectionTitle}
          className={mergeClasses(
            'flex flex-1 flex-col gap-5 border-e px-8 py-6',
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

          <div className="flex flex-col gap-1">
            <Label
              id={modelLabelId}
              label={labels.modelOrAgentLabel}
              required
            />
            {modelSelector}
            {errors.modelId && (
              <p
                className={mergeClasses(
                  instructionsErrorClassName,
                  styles.instructionsError,
                )}
              >
                {errors.modelId}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Select
              labelProps={{ label: labels.repeatLabel }}
              value={values.repeat}
              onChange={(next) =>
                onFieldChange('repeat', next as ScheduledTaskRepeat)
              }
              options={labels.repeatOptions.map((option) => ({
                value: option.key,
                label: option.label,
              }))}
            />

            {values.repeat === ScheduledTaskRepeat.OneTime && (
              <div className="flex flex-col gap-1">
                <Calendar
                  id="scheduled-task-run-at"
                  mode={CalendarMode.DateTime}
                  value={runAtToCalendarValue(values.runAt)}
                  onChange={(value) =>
                    onFieldChange('runAt', calendarValueToRunAt(value))
                  }
                  labelProps={{ label: labels.runAtLabel, required: true }}
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

            {values.repeat !== ScheduledTaskRepeat.OneTime && (
              <>
                {values.repeat !== ScheduledTaskRepeat.Hourly && (
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
                      labelProps={{ label: labels.timeLabel, required: true }}
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
                )}

                {values.repeat === ScheduledTaskRepeat.Weekly && (
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
                      labelProps={{
                        label: labels.dayOfWeekLabel,
                        required: true,
                      }}
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

                {values.repeat === ScheduledTaskRepeat.Monthly && (
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

                {values.repeat === ScheduledTaskRepeat.Hourly && (
                  <NumberInput
                    id="scheduled-task-minute"
                    integer
                    min={0}
                    max={59}
                    value={values.minute ?? ''}
                    onChange={(value) =>
                      onFieldChange(
                        'minute',
                        value != null ? String(value) : '',
                      )
                    }
                    labelProps={{
                      label: labels.minuteLabel,
                      required: true,
                    }}
                    invalid={Boolean(errors.minute)}
                    error={errors.minute}
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
                      labelProps={{ label: labels.startDateLabel }}
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
                      labelProps={{ label: labels.endDateLabel }}
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
          </div>
        </div>
      }
    >
      <div
        role="group"
        aria-label={labels.configurationSectionTitle}
        className="flex flex-1 flex-col gap-5 px-8 py-6"
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
          <span className={instructionsLabelClassName}>
            {labels.instructionsLabel}
          </span>
          <Suspense fallback={<Spinner />}>
            <MarkdownEditor
              value={values.prompt}
              onChange={(value) => onFieldChange('prompt', value)}
              height={480}
              theme={markdownEditorTheme as MarkdownEditorTheme}
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
    </BuilderFormContainer>
  );
};
