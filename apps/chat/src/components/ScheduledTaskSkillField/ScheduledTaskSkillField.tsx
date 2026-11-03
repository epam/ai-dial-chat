import {
  buildSkillSelectorOptions,
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
import {
  useScheduledTaskSkillDetails,
  type ScheduledTaskSkillDetails,
} from '../../hooks/scheduled-tasks/useUnavailableScheduledTaskSkills';

/** App skills and translation adapter for the reusable controlled field. */
const ScheduledTaskSkillField: FC<
  Omit<SkillSelectorFieldProps, 'labels' | 'displayNames' | 'skills'> & {
    fieldLabel: string;
    resolvedSkills?: ScheduledTaskSkillDetails[];
  }
> = ({ fieldLabel, resolvedSkills, ...props }) => {
  const { t } = useTranslation();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const options = useMemo(
    () => buildSkillSelectorOptions(skills, sharedWithMe, publicSkills),
    [skills, sharedWithMe, publicSkills],
  );
  const fetchedSkills = useScheduledTaskSkillDetails(
    resolvedSkills ? undefined : props.value,
  );
  const selectedSkills = resolvedSkills ?? fetchedSkills;
  const unavailableValues = selectedSkills
    .filter((skill) => skill.isUnavailable)
    .map((skill) => skill.url);
  const displayNames = Object.fromEntries(
    selectedSkills.map((skill) => {
      let name = skill.name;
      if (skill.isUnavailable || skill.isLoading) {
        name = skill.url.replace(/\/+$/, '').split('/').pop() || skill.url;
        try {
          name = decodeURIComponent(name);
        } catch {
          /* Preserve malformed escapes. */
        }
        if (skill.isUnavailable)
          name = t(SkillSelectorI18nKeys.UnavailableSkillName, { name });
      }
      return [skill.url, name];
    }),
  );
  const labels = useMemo(
    () => ({
      fieldLabel,
      unavailableTooltipLabel: t(SkillSelectorI18nKeys.UnavailableSkillTooltip),
      removeLabel: t(SkillSelectorI18nKeys.RemoveSkillLabel),
      placeholder: t(ScheduledTasksI18nKeys.CreateSkillPlaceholder),
      unsupportedTooltipLabel: t(SkillSelectorI18nKeys.UnsupportedTooltipLabel),
      unavailableHintLabel: t(SkillSelectorI18nKeys.UnavailableHintLabel),
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
      unavailableValues={unavailableValues}
      labels={labels}
      skills={options}
    />
  );
};

export default memo(ScheduledTaskSkillField);
