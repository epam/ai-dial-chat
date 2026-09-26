import { ScheduledTaskRepeat } from '@epam/ai-dial-scheduled-tasks';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  EditorI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useTextRefinementLabels } from '../useTextRefinementLabels';

/** Keeps create/edit form copy and repeat options identical at the app edge. */
export const useScheduledTaskFormLabels = (
  mode: 'create' | 'edit',
  isSkillSelectionEnabled = false,
) => {
  const { t } = useTranslation();
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
      configurationSectionSubtitle: t(
        isSkillSelectionEnabled
          ? ScheduledTasksI18nKeys.CreateConfigurationSectionSubtitle
          : ScheduledTasksI18nKeys.CreateInstructionsOnlySubtitle,
      ),
      skillLabel: t(ScheduledTasksI18nKeys.CreateSkillLabel),
      displayNameLabel: t(EditorI18nKeys.NameLabel),
      displayNameRequired: t(EditorI18nKeys.NameRequired),
      runAtLabel: t(ScheduledTasksI18nKeys.CreateRunAtLabel),
      timeLabel: t(ScheduledTasksI18nKeys.CreateTimeLabel),
      timeInvalidLabel: t(ScheduledTasksI18nKeys.CreateTimeInvalid),
      repeatLabel: t(ScheduledTasksI18nKeys.CreateRepeatLabel),
      repeatOptions: [
        ScheduledTaskRepeat.OneTime,
        ScheduledTaskRepeat.Hourly,
        ScheduledTaskRepeat.Daily,
        ScheduledTaskRepeat.Weekly,
        ScheduledTaskRepeat.Monthly,
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
          }[key],
        ),
      })),
      dayOfWeekLabel: t(ScheduledTasksI18nKeys.CreateDayOfWeekLabel),
      dayOfMonthLabel: t(ScheduledTasksI18nKeys.CreateDayOfMonthLabel),
      minuteLabel: t(ScheduledTasksI18nKeys.CreateMinuteLabel),
      startDateLabel: t(ScheduledTasksI18nKeys.CreateStartDateLabel),
      startDatePlaceholder: t(
        ScheduledTasksI18nKeys.CreateStartDatePlaceholder,
      ),
      endDateLabel: t(ScheduledTasksI18nKeys.CreateEndDateLabel),
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
    [mode, t, refinementLabels, isSkillSelectionEnabled],
  );
};
