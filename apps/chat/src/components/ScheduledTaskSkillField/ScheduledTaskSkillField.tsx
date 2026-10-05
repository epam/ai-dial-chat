import {
  SkillSelectorField,
  type SkillSelectorFieldProps,
} from '@epam/ai-dial-skills';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ScheduledTasksI18nKeys,
  SkillSelectorI18nKeys,
} from '../../constants/translation-keys';
import { useSkills } from '../../context/SkillsContext';
import { useScheduledTaskSkillDisplayNames } from '../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames';

/** App skills and translation adapter for the reusable controlled field. */
const ScheduledTaskSkillField: FC<
  Omit<SkillSelectorFieldProps, 'labels' | 'displayNames' | 'skills'> & {
    fieldLabel: string;
  }
> = ({ fieldLabel, ...props }) => {
  const { t } = useTranslation();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const options = useMemo(() => {
    const entries = new Map(
      [...skills, ...(sharedWithMe ?? []), ...publicSkills].map((skill) => [
        skill.url,
        { id: skill.url, name: skill.name },
      ]),
    );
    return [...entries.values()];
  }, [skills, sharedWithMe, publicSkills]);
  const names = useScheduledTaskSkillDisplayNames(props.value);
  const displayNames = Object.fromEntries(
    props.value.map((url, index) => [url, names[index]]),
  );
  const labels = useMemo(
    () => ({
      fieldLabel,
      placeholder: t(ScheduledTasksI18nKeys.CreateSkillPlaceholder),
      unsupportedTooltipLabel: t(SkillSelectorI18nKeys.UnsupportedTooltipLabel),
      unavailableTooltipLabel: t(SkillSelectorI18nKeys.UnavailableTooltipLabel),
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
      emptyLabel: t(SkillSelectorI18nKeys.NoSkillsLabel),
      noMatchingSkillsLabel: t(SkillSelectorI18nKeys.NoMatchingSkillsLabel),
    }),
    [fieldLabel, t],
  );
  return (
    <SkillSelectorField
      {...props}
      displayNames={displayNames}
      labels={labels}
      skills={options}
    />
  );
};

export default memo(ScheduledTaskSkillField);
