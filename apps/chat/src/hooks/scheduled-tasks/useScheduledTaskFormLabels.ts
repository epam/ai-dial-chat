import { ScheduledTaskRepeat } from '@epam/ai-dial-scheduled-tasks';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  EditorI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useTextRefinementLabels } from '../useTextRefinementLabels';

/** Week counts offered by the Custom repeat's "Every" dropdown. */
const EVERY_WEEKS_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** APScheduler-convention day values (`'0'` Monday – `'6'` Sunday) for the Custom repeat's day row. */
const CUSTOM_DAY_VALUES = ['0', '1', '2', '3', '4', '5', '6'] as const;

/** Keeps create/edit form copy and repeat options identical at the app edge. */
export const useScheduledTaskFormLabels = (mode: 'create' | 'edit') => {
  const { t, i18n } = useTranslation();
  const refinementLabels = useTextRefinementLabels();
  return useMemo(
    () => ({
      ...refinementLabels,
      pageTitle: t(
        mode === 'create'
          ? ScheduledTasksI18nKeys.CreatePageTitle
          : ScheduledTasksI18nKeys.EditPageTitle,
      ),
      backButtonLabel: t(ScheduledTasksI18nKeys.CreateBackButtonLabel),
      detailsSectionTitle: t(ScheduledTasksI18nKeys.CreateDetailsSectionTitle),
      detailsSectionSubtitle: t(
        ScheduledTasksI18nKeys.CreateDetailsSectionSubtitle,
      ),
      configurationSectionTitle: t(
        ScheduledTasksI18nKeys.CreateConfigurationSectionTitle,
      ),
      skillLabel: t(ScheduledTasksI18nKeys.CreateSkillLabel),
      displayNameLabel: t(EditorI18nKeys.NameLabel),
      displayNameRequired: t(EditorI18nKeys.NameRequired),
      runAtLabel: t(ScheduledTasksI18nKeys.CreateRunAtLabel),
      runAtPlaceholder: t(ScheduledTasksI18nKeys.CreateRunAtPlaceholder),
      timeLabel: t(ScheduledTasksI18nKeys.CreateTimeLabel),
      timeInvalidLabel: t(ScheduledTasksI18nKeys.CreateTimeInvalid),
      repeatLabel: t(ScheduledTasksI18nKeys.CreateRepeatLabel),
      repeatOptions: [
        ScheduledTaskRepeat.OneTime,
        ScheduledTaskRepeat.Hourly,
        ScheduledTaskRepeat.Daily,
        ScheduledTaskRepeat.Weekly,
        ScheduledTaskRepeat.Monthly,
        ScheduledTaskRepeat.Custom,
      ].map((key) => ({
        key,
        label: t(
          {
            [ScheduledTaskRepeat.OneTime]:
              ScheduledTasksI18nKeys.CreateRepeatOneTime,
            [ScheduledTaskRepeat.Hourly]:
              ScheduledTasksI18nKeys.CreateRepeatHourly,
            [ScheduledTaskRepeat.Daily]:
              ScheduledTasksI18nKeys.CreateRepeatDaily,
            [ScheduledTaskRepeat.Weekly]:
              ScheduledTasksI18nKeys.CreateRepeatWeekly,
            [ScheduledTaskRepeat.Monthly]:
              ScheduledTasksI18nKeys.CreateRepeatMonthly,
            [ScheduledTaskRepeat.Custom]:
              ScheduledTasksI18nKeys.CreateRepeatCustom,
          }[key],
        ),
      })),
      everyLabel: t(ScheduledTasksI18nKeys.CreateEveryLabel),
      everyWeekOptions: EVERY_WEEKS_COUNTS.map((count) => ({
        value: String(count),
        label: t(ScheduledTasksI18nKeys.CreateEveryWeeksOption, { count }),
      })),
      /* 2023-01-02 is a Monday; the APScheduler day value counts Monday-first,
       * so the reference lands on each segment's own day. Both formatters run
       * in UTC so the localized weekday is the segment's day, not the local
       * calendar's. */
      customDayOptions: CUSTOM_DAY_VALUES.map((value) => {
        const dayDate = new Date(Date.UTC(2023, 0, 2 + Number(value)));
        return {
          value,
          shortLabel: new Intl.DateTimeFormat(i18n.language, {
            weekday: 'narrow',
            timeZone: 'UTC',
          }).format(dayDate),
          fullName: new Intl.DateTimeFormat(i18n.language, {
            weekday: 'long',
            timeZone: 'UTC',
          }).format(dayDate),
        };
      }),
      dayOfWeekLabel: t(ScheduledTasksI18nKeys.CreateDayOfWeekLabel),
      dayOfMonthLabel: t(ScheduledTasksI18nKeys.CreateDayOfMonthLabel),
      minuteLabel: t(ScheduledTasksI18nKeys.CreateMinuteLabel),
      startDateLabel: t(ScheduledTasksI18nKeys.CreateStartDateLabel),
      startDateAndTimeLabel: t(
        ScheduledTasksI18nKeys.CreateStartDateAndTimeLabel,
      ),
      startDatePlaceholder: t(
        ScheduledTasksI18nKeys.CreateStartDatePlaceholder,
      ),
      endDateLabel: t(ScheduledTasksI18nKeys.CreateEndDateLabel),
      endDateAndTimeLabel: t(ScheduledTasksI18nKeys.CreateEndDateAndTimeLabel),
      endDatePlaceholder: t(ScheduledTasksI18nKeys.CreateEndDatePlaceholder),
      modelOrAgentLabel: t(ScheduledTasksI18nKeys.CreateModelOrAgentLabel),
      descriptionLabel: t(ScheduledTasksI18nKeys.CreateDescriptionLabel),
      instructionsLabel: t(ScheduledTasksI18nKeys.CreateInstructionsLabel),
      cancelButtonLabel: t(ButtonsI18nKeys.Cancel),
      createButtonLabel: t(
        mode === 'create' ? ButtonsI18nKeys.Create : ButtonsI18nKeys.Save,
      ),
      submittingLabel: t(
        mode === 'create'
          ? ScheduledTasksI18nKeys.CreateSubmittingLabel
          : ButtonsI18nKeys.Saving,
      ),
    }),
    [mode, t, i18n.language, refinementLabels],
  );
};
