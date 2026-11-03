import { Tooltip } from '@epam/ai-dial-ui-kit';
import { useTranslation } from 'react-i18next';
import { SkillSelectorI18nKeys } from '../../constants/translation-keys';
import { useScheduledTaskSkillDetails } from './useUnavailableScheduledTaskSkills';

/** Supplies localized availability presentation while keeping API knowledge in the app. */
export const useScheduledTaskSkillPreview = (skillUrls?: string[]) => {
  const { t } = useTranslation();
  const skills = useScheduledTaskSkillDetails(skillUrls);
  const skillDisplayNames = skills.some((skill) => skill.isLoading)
    ? []
    : skills.map((skill) => {
        if (!skill.isUnavailable) return skill.name;
        let name = skill.url.replace(/\/+$/, '').split('/').pop() || skill.url;
        try {
          name = decodeURIComponent(name);
        } catch {
          /* Keep malformed escapes readable. */
        }
        return t(SkillSelectorI18nKeys.UnavailableSkillName, { name });
      });
  const renderSkillName = (name: string, index: number) =>
    skills[index]?.isUnavailable ? (
      <Tooltip
        tooltip={t(SkillSelectorI18nKeys.UnavailableSkillTooltip)}
        asChild
      >
        <span tabIndex={0} className="cursor-pointer text-error">
          {name}
        </span>
      </Tooltip>
    ) : (
      name
    );
  return { skillDisplayNames, renderSkillName };
};
