import { BuilderFormContainer } from '@epam/ai-dial-builder-form';
import {
  buildCssVars,
  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
  mergeClasses,
  useAvailableHeightCap,
  TextRefinementField,
  useTextRefinement,
  type TextRefinementCallback,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Input,
  Textarea,
  Calendar,
  CalendarMode,
  type CalendarValue,
  Label,
  NumberInput,
  Spinner,
  Select,
} from '@epam/ai-dial-ui-kit';
import { LazyMarkdownEditor } from '@epam/ai-dial-ui-kit/editors';
import { IconArrowNarrowLeft } from '@tabler/icons-react';
/*
 * Only needed once `LazyMarkdownEditor` actually renders (below). Importing
 * it here, rather than eagerly from the host app's entry point, keeps this
 * vendor CSS out of the initial page load — it loads only when this module
 * does, i.e. when the (already route-lazy) scheduled-task pages mount.
 */
import '@uiw/react-markdown-preview/markdown.css';
import '@uiw/react-md-editor/markdown-editor.css';
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type FocusEventHandler,
} from 'react';
import { SCHEDULED_TASKS_CLASS } from '../../constants/public-class-names';
import { DESCRIPTION_MAX_LENGTH } from '../../constants/scheduled-task-create-form';
import { ScheduledTaskCreateFormProps } from '../../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../../types/scheduled-task-schedule';
import {
  calendarValueToDateValue,
  calendarValueToDayOfWeek,
  dateValueToCalendarValue,
  dayOfWeekToCalendarValue,
  TIME_OF_DAY_PATTERN,
} from '../../utils/calendar-value';
import { ScheduledTaskRunAtField } from '../ScheduledTaskRunAtField/ScheduledTaskRunAtField';
import styles from './ScheduledTaskCreateForm.module.scss';

const MarkdownEditor = lazy(async () => {
  const module = await LazyMarkdownEditor();
  return { default: module.MarkdownEditor };
});

/**
 * Presentational create-task form: a back-navigable header (Cancel/Save
 * actions) and a two-column Details/Configuration body. Details holds
 * display name, description, the schedule fields (including the masked
 * time-of-day picker with the viewer's timezone hint and blur validation),
 * and the Model or Agent field; Configuration holds the markdown
 * Instructions editor. Field values and validation errors are supplied by
 * the host app, and the Model or Agent field's control (`modelSelector`) is
 * a fully-composed host-rendered element; this component performs no
 * routing, i18n, or network calls of its own.
 */
export const ScheduledTaskCreateForm: FC<ScheduledTaskCreateFormProps> = ({
  labels,
  values,
  errors,
  modelSelector,
  modelLabelId,
  skillSelector,
  skillLabelId,
  skillErrorId,
  onFieldChange,
  onBack,
  onCancel,
  onSubmit,
  isSubmitting = false,
  onRefineDescription,
  onRefineInstructions,
  markdownEditorTheme,
  backIcon,
  className,
  styles: formStyles,
}) => {
  const descriptionId = useId();
  const instructionsEditorId = useId();
  const refinementLock = useRef<AbortSignal | undefined>(undefined);
  const guardRefinement = (
    callback?: TextRefinementCallback,
  ): TextRefinementCallback | undefined =>
    callback
      ? async (value, signal) => {
          if (refinementLock.current && !refinementLock.current.aborted)
            throw new DOMException('Busy', 'AbortError');
          refinementLock.current = signal;
          try {
            return await callback(value, signal);
          } finally {
            if (refinementLock.current === signal)
              refinementLock.current = undefined;
          }
        }
      : undefined;
  const descriptionRefinement = useTextRefinement({
    value: values.description ?? '',
    onChange: (value) => onFieldChange('description', value),
    onRefine: guardRefinement(onRefineDescription),
    disabled: isSubmitting,
  });
  const instructionsRefinement = useTextRefinement({
    value: values.prompt,
    onChange: (value) => onFieldChange('prompt', value),
    onRefine: guardRefinement(onRefineInstructions),
    disabled: isSubmitting,
  });
  const isRefining =
    descriptionRefinement.isPending || instructionsRefinement.isPending;
  const resetRefinement = () => {
    descriptionRefinement.reset();
    instructionsRefinement.reset();
  };
  const instructionsCapRef = useAvailableHeightCap<HTMLDivElement>();
  const [timeBlurError, setTimeBlurError] = useState<string>();
  const { colors, typography, layout } = formStyles ?? {};
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
    '--stcf-refine-action-text': colors?.refineActionText,
    '--stcf-refine-error-text': colors?.refineErrorText,
  });

  const refinementStyles = {
    feedbackClassName: mergeClasses(
      styles.refineFeedback,
      typography?.refineFeedbackClassName ?? 'dial-small-text',
      SCHEDULED_TASKS_CLASS.refineFeedback,
    ),
    errorClassName: styles.refineError,
  };
  /*
   * The masked time input only reports complete `HH:mm` values through
   * onChange, so a cleared or half-typed draft never reaches `values.time` —
   * the blur pass below validates the visible draft instead.
   */
  const handleTimeBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    const errorLabel = TIME_OF_DAY_PATTERN.test(event.target.value)
      ? undefined
      : labels.timeInvalidLabel;

    setTimeBlurError(errorLabel);
    onFieldChange('time', event.target.value);
  };

  const handleTimeChange = (value: CalendarValue) => {
    setTimeBlurError(undefined);
    onFieldChange('time', typeof value === 'string' ? value : '');
  };

  const isTimeFieldShown =
    values.repeat !== ScheduledTaskRepeat.OneTime &&
    values.repeat !== ScheduledTaskRepeat.Hourly;

  /*
   * A blur error describes the time field's visible draft. When a repeat
   * switch hides the field, that draft is gone — reset the error so a
   * later switch back cannot re-show a stale error under the (valid)
   * controlled value and silently block Save.
   */
  useEffect(() => {
    if (!isTimeFieldShown) {
      setTimeBlurError(undefined);
    }
  }, [isTimeFieldShown]);

  const timeError = isTimeFieldShown
    ? (timeBlurError ?? errors.time)
    : undefined;

  const handleRunAtChange = (value: string) => onFieldChange('runAt', value);

  const isCreateDisabled =
    isSubmitting ||
    isRefining ||
    !values.displayName.trim() ||
    !values.modelId ||
    (!values.prompt.trim() && !values.skillUrl?.trim()) ||
    Boolean(errors.skillUrl) ||
    /* An empty shown time blocks Save immediately, like the other required
     * fields — the blur error alone would only catch it on blur or submit. */
    (isTimeFieldShown && !values.time) ||
    Boolean(timeError);

  return (
    <BuilderFormContainer
      labels={{
        title: labels.pageTitle,
        backButtonLabel: labels.backButtonLabel,
        cancelButtonLabel: labels.cancelButtonLabel,
        submitButtonLabel: labels.createButtonLabel,
        submittingLabel: labels.submittingLabel ?? 'Saving',
      }}
      onBack={() => {
        resetRefinement();
        onBack();
      }}
      onCancel={() => {
        resetRefinement();
        onCancel();
      }}
      onSubmit={() => {
        if (
          !isCreateDisabled &&
          (!refinementLock.current || refinementLock.current.aborted)
        )
          onSubmit();
      }}
      isCancelDisabled={isSubmitting}
      isSubmitDisabled={isCreateDisabled}
      isSubmitting={isSubmitting}
      backIcon={
        backIcon === undefined ? (
          <IconArrowNarrowLeft
            size={DIAL_ICON_SIZE.LG}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
            className="rtl:scale-x-[-1]"
          />
        ) : (
          backIcon
        )
      }
      layout={{
        sideColumnWidth: layout?.detailsWidth,
        columnGap: layout?.columnGap,
        reserveEndColumn: false,
      }}
      className={className}
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
            'flex flex-1 flex-col gap-5 border-e py-6',
            styles.detailsColumn,
            styles.formColumn,
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

          <TextRefinementField
            isEnabled={Boolean(onRefineDescription)}
            fieldId={descriptionId}
            label={labels.descriptionLabel}
            labels={labels}
            refinement={descriptionRefinement}
            disabled={isSubmitting || isRefining}
            {...refinementStyles}
          >
            <Textarea
              id={descriptionId}
              value={values.description ?? ''}
              onChange={(value) => {
                descriptionRefinement.reset();
                onFieldChange('description', value);
              }}
              labelProps={
                onRefineDescription
                  ? undefined
                  : { label: labels.descriptionLabel }
              }
              maxLength={DESCRIPTION_MAX_LENGTH}
              invalid={Boolean(errors.description)}
              error={errors.description}
              caption={
                values.description
                  ? `${values.description.length}/${DESCRIPTION_MAX_LENGTH}`
                  : undefined
              }
            />
          </TextRefinementField>

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
              <ScheduledTaskRunAtField
                label={labels.runAtLabel}
                value={values.runAt ?? ''}
                onChange={handleRunAtChange}
                error={errors.runAt}
                errorClassName={instructionsErrorClassName}
              />
            )}

            {values.repeat !== ScheduledTaskRepeat.OneTime && (
              <>
                {isTimeFieldShown && (
                  <div className="flex flex-col gap-1">
                    <Calendar
                      id="scheduled-task-time"
                      mode={CalendarMode.Time}
                      value={values.time}
                      onChange={handleTimeChange}
                      onBlur={handleTimeBlur}
                      labelProps={{ label: labels.timeLabel, required: true }}
                      invalid={Boolean(timeError)}
                      disabled={isSubmitting}
                      showTimezone
                    />
                    {timeError && (
                      <p
                        className={mergeClasses(
                          instructionsErrorClassName,
                          styles.instructionsError,
                        )}
                      >
                        {timeError}
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
                {/* The two date fields always share one row. */}
                <div className="flex flex-row gap-3">
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
        className={mergeClasses(
          'flex flex-1 flex-col gap-5 py-6',
          styles.formColumn,
        )}
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

        {skillSelector != null && (
          <div className="flex w-full min-w-0 max-w-[996px] flex-col gap-1">
            <span id={skillLabelId} className={instructionsLabelClassName}>
              {labels.skillLabel}
            </span>
            {skillSelector}
          </div>
        )}
        <div
          id={skillErrorId}
          aria-live="polite"
          className={errors.skillUrl ? undefined : 'sr-only'}
        >
          {errors.skillUrl && (
            <p
              className={mergeClasses(
                instructionsErrorClassName,
                styles.instructionsError,
              )}
            >
              {errors.skillUrl}
            </p>
          )}
        </div>
        {/*
         * Cap the whole group, not just the editor: the Refine action sits at the
         * end of the label row, so an uncapped row lets it drift past the editor
         * whenever the column is wider than the cap (e.g. at browser zoom-out).
         */}
        <div className="flex w-full min-w-0 max-w-[996px] flex-col">
          <TextRefinementField
            isEnabled={Boolean(onRefineInstructions)}
            fieldId={instructionsEditorId}
            labelClassName={instructionsLabelClassName}
            label={labels.instructionsLabel}
            labels={labels}
            refinement={instructionsRefinement}
            disabled={isSubmitting || isRefining}
            {...refinementStyles}
          >
            <div className="flex flex-1 flex-col gap-1">
              {/*
               * A real <label for>, not a span: the markdown editor renders a plain
               * textarea, and text sitting next to it names nothing the browser
               * associates with the control.
               */}
              {!onRefineInstructions && (
                <label
                  htmlFor={instructionsEditorId}
                  className={instructionsLabelClassName}
                >
                  {labels.instructionsLabel}
                </label>
              )}
              <div
                ref={instructionsCapRef}
                className={mergeClasses(
                  'w-full',
                  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
                  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
                )}
              >
                <Suspense fallback={<Spinner />}>
                  <MarkdownEditor
                    id={instructionsEditorId}
                    value={values.prompt}
                    onChange={(value) => {
                      instructionsRefinement.reset();
                      onFieldChange('prompt', value);
                    }}
                    height={480}
                    theme={markdownEditorTheme}
                    placeholder={labels.instructionsPlaceholder}
                  />
                </Suspense>
              </div>
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
          </TextRefinementField>
        </div>
      </div>
    </BuilderFormContainer>
  );
};
