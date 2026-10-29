import { BuilderFormContainer } from '@epam/ai-dial-builder-form';
import {
  buildCssVars,
  ConfirmationDialog,
  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
  mergeClasses,
  useAvailableHeightCap,
  TextRefinementField,
  useTextRefinement,
  useUnsavedChangesGuard,
  type TextRefinementCallback,
  useControlErrorAssociation,
} from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  ConfirmationPopupVariant,
  ErrorText,
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
  LiveRegionPoliteness,
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
import { findElementLabelledBy } from '../../utils/aria';
import {
  calendarValueToDayOfWeek,
  dayOfWeekToCalendarValue,
  TIME_OF_DAY_PATTERN,
} from '../../utils/calendar-value';
import { hasScheduledTaskFormChanges } from '../../utils/scheduled-task-form-values';
import { keepWindowBoundaryOnRepeatSwitch } from '../../utils/window-boundary';
import { ScheduledTaskBoundaryField } from '../ScheduledTaskBoundaryField/ScheduledTaskBoundaryField';
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
  initialValues,
  errors,
  modelSelector,
  modelLabelId,
  skillSelector,
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
  const dayOfWeekLabelId = useId();
  const modelErrorId = useId();
  const dayOfWeekErrorId = useId();
  const timeErrorId = useId();
  const promptErrorId = useId();
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
  const isDirty = Boolean(
    initialValues && hasScheduledTaskFormChanges(values, initialValues),
  );
  const leaveGuard = useUnsavedChangesGuard(isDirty);
  const handleBack = () =>
    leaveGuard.guard(() => {
      resetRefinement();
      onBack();
    });
  const handleCancel = () =>
    leaveGuard.guard(() => {
      resetRefinement();
      onCancel();
    });
  const instructionsCapRef = useAvailableHeightCap<HTMLDivElement>();
  /* Instructions are only mandatory while no skill supplies the content. */
  const isInstructionsRequired = !values.skillUrls?.length;
  const [timeBlurError, setTimeBlurError] = useState<string>();
  /* Pinned at mount through a ref — `useMemo` is only a performance hint
   * React may discard, and the earliest selectable day must stay fixed for
   * the component's lifetime — the same pin `ScheduledTaskRunAtField`
   * applies to the one-shot run-at picker. */
  const minDate = useRef(new Date()).current;
  const { colors, typography, layout } = formStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const sectionTitleClassName =
    typography?.sectionTitleClassName ?? 'dial-body-semi-text';
  const sectionSubtitleClassName =
    typography?.sectionSubtitleClassName ?? 'dial-tiny-text';
  const instructionsLabelClassName =
    typography?.instructionsLabelClassName ?? 'dial-body-semi-text mb-1';
  const instructionsErrorClassName =
    typography?.instructionsErrorClassName ?? 'dial-tiny-text';
  const cssVars = buildCssVars({
    '--stcf-details-border': colors?.detailsColumnBorder,
    '--stcf-subtitle-text': colors?.sectionSubtitleText,
    '--stcf-error-text': colors?.instructionsErrorText,
    '--stcf-refine-action-text': colors?.refineActionText,
    '--stcf-refine-error-text': colors?.refineErrorText,
  });

  const refinementStyles = {
    feedbackClassName: mergeClasses(
      // Unset overrides keep the kit CaptionText input-caption styling.
      colors?.refineActionText && styles.refineFeedback,
      typography?.refineFeedbackClassName,
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

  /*
   * A repeat switch clears both window boundaries whenever the boundary
   * shape changes (see `keepWindowBoundaryOnRepeatSwitch`): an hourly
   * boundary is an exact picked instant while a day-based one is a whole
   * local day, so carrying a value across would silently change its
   * meaning. A switch within the day-based cadences keeps both as-is.
   */
  const handleRepeatChange = (next: string | string[]) => {
    const repeat = next as ScheduledTaskRepeat;
    onFieldChange('repeat', repeat);
    const startDate = keepWindowBoundaryOnRepeatSwitch(
      values.startDate,
      values.repeat,
      repeat,
    );
    if (startDate !== values.startDate) {
      onFieldChange('startDate', startDate ?? '');
    }
    const endDate = keepWindowBoundaryOnRepeatSwitch(
      values.endDate,
      values.repeat,
      repeat,
    );
    if (endDate !== values.endDate) {
      onFieldChange('endDate', endDate ?? '');
    }
  };

  const isTimeFieldShown =
    values.repeat !== ScheduledTaskRepeat.OneTime &&
    values.repeat !== ScheduledTaskRepeat.Hourly;

  /* Hourly repeats pick exact window boundaries: date-and-time pickers
   * writing `YYYY-MM-DDTHH:mm` values, unlike the day-based repeats' date-only
   * pair. A repeat switch that changes the boundary shape clears both
   * boundaries (see `handleRepeatChange`), so the shape always matches the
   * pickers. */
  const isHourlyRepeat = values.repeat === ScheduledTaskRepeat.Hourly;
  const isCustomRepeat = values.repeat === ScheduledTaskRepeat.Custom;
  /* Custom blocks Save until a weekday is selected, like the other
   * required fields. */
  const isCustomDayMissing = isCustomRepeat && !values.dayOfWeek;
  const boundaryMode = isHourlyRepeat
    ? CalendarMode.DateTime
    : CalendarMode.Date;
  const startBoundaryLabel = isHourlyRepeat
    ? labels.startDateAndTimeLabel
    : labels.startDateLabel;
  const endBoundaryLabel = isHourlyRepeat
    ? labels.endDateAndTimeLabel
    : labels.endDateLabel;

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

  /* The model selector is host-composed; its contract is to carry `modelLabelId` in `aria-labelledby`. */
  useControlErrorAssociation(
    () => findElementLabelledBy(modelLabelId),
    modelErrorId,
    Boolean(errors.modelId),
  );
  useControlErrorAssociation(
    () => document.getElementById('scheduled-task-day-of-week'),
    dayOfWeekErrorId,
    Boolean(errors.dayOfWeek),
  );
  useControlErrorAssociation(
    () => document.getElementById('scheduled-task-time'),
    timeErrorId,
    Boolean(timeError),
  );
  useControlErrorAssociation(
    () => document.getElementById(instructionsEditorId),
    promptErrorId,
    Boolean(errors.prompt),
  );

  const handleRunAtChange = (value: string) => onFieldChange('runAt', value);

  const handleEveryWeeksChange = (next: string | string[]) => {
    onFieldChange('everyWeeks', next as string);
  };

  /* The Custom day row is single-select and required, so re-activating the
   * already-selected day is a no-op — exactly one day stays selected. */
  const handleCustomDaySelect = (day: string) => {
    if (day !== values.dayOfWeek) {
      onFieldChange('dayOfWeek', day);
    }
  };

  const isCreateDisabled =
    isSubmitting ||
    isRefining ||
    !values.displayName.trim() ||
    !values.modelId ||
    (!values.prompt.trim() && !values.skillUrls?.length) ||
    Boolean(errors.skillUrls) ||
    /* An empty shown run-at blocks Save immediately, like the other required
     * fields — and a submit-time run-at error keeps it blocked until the host
     * clears the error on the next run-at change. */
    (values.repeat === ScheduledTaskRepeat.OneTime &&
      (!values.runAt || Boolean(errors.runAt))) ||
    /* An empty shown time blocks Save immediately, like the other required
     * fields — the blur error alone would only catch it on blur or submit. */
    (isTimeFieldShown && !values.time) ||
    isCustomDayMissing ||
    Boolean(timeError);

  return (
    <>
      <BuilderFormContainer
        labels={{
          title: labels.pageTitle,
          backButtonLabel: labels.backButtonLabel,
          cancelButtonLabel: labels.cancelButtonLabel,
          submitButtonLabel: labels.createButtonLabel,
          submittingLabel: labels.submittingLabel ?? 'Saving',
        }}
        onBack={handleBack}
        onCancel={handleCancel}
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
              /* The column divider only makes sense side by side; below the
               * desktop breakpoint the columns stack and it would draw a
               * stray vertical line down the Details section. */
              'flex flex-1 flex-col gap-5 py-6 desktop:border-e',
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
              caption={`${(values.description ?? '').length}/${DESCRIPTION_MAX_LENGTH}`}
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
                <ErrorText
                  id={modelErrorId}
                  className={mergeClasses(
                    instructionsErrorClassName,
                    styles.instructionsError,
                  )}
                  text={errors.modelId}
                />
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Select
                labelProps={{ label: labels.repeatLabel }}
                value={values.repeat}
                onChange={handleRepeatChange}
                options={labels.repeatOptions.map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
              />

              {values.repeat === ScheduledTaskRepeat.OneTime && (
                <ScheduledTaskRunAtField
                  label={labels.runAtLabel}
                  placeholder={labels.runAtPlaceholder}
                  value={values.runAt ?? ''}
                  onChange={handleRunAtChange}
                  error={errors.runAt}
                  errorClassName={instructionsErrorClassName}
                  disabled={isSubmitting}
                />
              )}

              {values.repeat !== ScheduledTaskRepeat.OneTime && (
                <>
                  {isCustomRepeat && (
                    <Select
                      id="scheduled-task-every-weeks"
                      labelProps={{ label: labels.everyLabel }}
                      value={values.everyWeeks ?? ''}
                      onChange={handleEveryWeeksChange}
                      options={labels.everyWeekOptions}
                      disabled={isSubmitting}
                    />
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
                        <ErrorText
                          id={dayOfWeekErrorId}
                          className={mergeClasses(
                            instructionsErrorClassName,
                            styles.instructionsError,
                          )}
                          text={errors.dayOfWeek}
                        />
                      )}
                    </div>
                  )}

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
                        <ErrorText
                          id={timeErrorId}
                          className={mergeClasses(
                            instructionsErrorClassName,
                            styles.instructionsError,
                          )}
                          text={timeError}
                        />
                      )}
                    </div>
                  )}

                  {isCustomRepeat && (
                    <div className="flex flex-col gap-1">
                      {/* The visible "Day" label doubles as the button row's
                       * accessible name, mirroring the Model or Agent field's
                       * Label id + aria-labelledby linkage. */}
                      <Label
                        id={dayOfWeekLabelId}
                        label={labels.dayOfWeekLabel}
                        required
                      />
                      <div
                        role="group"
                        aria-labelledby={dayOfWeekLabelId}
                        className="flex gap-0.5"
                      >
                        {/* Circular single-select day row: Neutral Solid when
                         * unselected, Primary Solid when selected. */}
                        {labels.customDayOptions.map((day) => {
                          const isSelected = day.value === values.dayOfWeek;
                          return (
                            <Button
                              key={day.value}
                              aria-label={day.fullName}
                              aria-pressed={isSelected}
                              aria-describedby={
                                errors.dayOfWeek ? dayOfWeekErrorId : undefined
                              }
                              variant={
                                isSelected
                                  ? ButtonVariant.Primary
                                  : ButtonVariant.Neutral
                              }
                              appearance={ButtonAppearance.Solid}
                              /* 40x40px circular: the kit's Standard size
                               * already gives a 40px height; the fixed
                               * width makes the row a circle run. */
                              className="w-10 rounded-full"
                              label={day.shortLabel}
                              onClick={() => handleCustomDaySelect(day.value)}
                              disabled={isSubmitting}
                            />
                          );
                        })}
                      </div>
                      {errors.dayOfWeek && (
                        <ErrorText
                          id={dayOfWeekErrorId}
                          className={mergeClasses(
                            instructionsErrorClassName,
                            styles.instructionsError,
                          )}
                          text={errors.dayOfWeek}
                        />
                      )}
                    </div>
                  )}

                  {values.repeat === ScheduledTaskRepeat.Monthly && (
                    <NumberInput
                      id="scheduled-task-day-of-month"
                      integer
                      min={1}
                      max={31}
                      value={values.dayOfMonth ?? ''}
                      onChange={(value) =>
                        onFieldChange(
                          'dayOfMonth',
                          value != null ? String(value) : '',
                        )
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
                      /* Fixed design width on the field box — `className`
                       * would land on the inner input element, which is
                       * `w-full` inside the box and ignores it. */
                      wrapperClassName="w-[142px]"
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
                  {/* Custom renders no boundary fields — it has no activity
                   * window by design (see the Custom repeat requirement). */}
                  {!isCustomRepeat && (
                    /* The two boundary fields share one row for time-of-day
                     * repeats; for hourly repeats each takes its own
                     * full-width row as a date-and-time picker. */
                    <div
                      className={mergeClasses(
                        'gap-3',
                        isHourlyRepeat ? 'flex flex-col' : 'flex flex-row',
                      )}
                    >
                      <ScheduledTaskBoundaryField
                        id="scheduled-task-start-date"
                        mode={boundaryMode}
                        label={startBoundaryLabel}
                        placeholder={labels.startDatePlaceholder}
                        value={values.startDate}
                        onChange={(value) => onFieldChange('startDate', value)}
                        minDate={minDate}
                        error={errors.startDate}
                        errorClassName={instructionsErrorClassName}
                        disabled={isSubmitting}
                      />

                      <ScheduledTaskBoundaryField
                        id="scheduled-task-end-date"
                        mode={boundaryMode}
                        label={endBoundaryLabel}
                        placeholder={labels.endDatePlaceholder}
                        value={values.endDate}
                        onChange={(value) => onFieldChange('endDate', value)}
                        minDate={minDate}
                        error={errors.endDate}
                        errorClassName={instructionsErrorClassName}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
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
          </div>

          {skillSelector != null ? (
            <div className="w-full max-w-[996px] min-w-0">{skillSelector}</div>
          ) : (
            /* Always mounted so the polite region exists before the error
               arrives; the kit region takes no space while empty. */
            <ErrorText
              announce={LiveRegionPoliteness.Polite}
              className={mergeClasses(
                instructionsErrorClassName,
                styles.instructionsError,
              )}
              text={errors.skillUrls ?? ''}
            />
          )}
          {/*
           * Cap the whole group, not just the editor: the Refine action sits at the
           * end of the label row, so an uncapped row lets it drift past the editor
           * whenever the column is wider than the cap (e.g. at browser zoom-out).
           */}
          <div className="flex w-full max-w-[996px] min-w-0 flex-col">
            <TextRefinementField
              isEnabled={Boolean(onRefineInstructions)}
              fieldId={instructionsEditorId}
              labelClassName={instructionsLabelClassName}
              label={labels.instructionsLabel}
              required={isInstructionsRequired}
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
                  <Label
                    htmlFor={instructionsEditorId}
                    className={instructionsLabelClassName}
                    label={labels.instructionsLabel}
                    required={isInstructionsRequired}
                  />
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
                  <ErrorText
                    id={promptErrorId}
                    className={mergeClasses(
                      instructionsErrorClassName,
                      styles.instructionsError,
                    )}
                    text={errors.prompt}
                  />
                )}
              </div>
            </TextRefinementField>
          </div>
        </div>
      </BuilderFormContainer>
      {leaveGuard.isConfirmOpen && (
        <ConfirmationDialog
          open
          title={labels.discardTitle ?? 'Discard unsaved changes?'}
          message={
            labels.discardMessage ??
            'You have unsaved changes. Leaving now will discard them.'
          }
          confirmLabel={labels.discardConfirmLabel ?? 'Discard changes'}
          cancelLabel={labels.discardCancelLabel ?? 'Keep editing'}
          variant={ConfirmationPopupVariant.Danger}
          onConfirm={leaveGuard.confirm}
          onClose={leaveGuard.dismiss}
        />
      )}
    </>
  );
};
