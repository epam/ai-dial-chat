import type { ProjectOutputsLabels } from '@epam/ai-dial-projects';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';

/**
 * Resolves every string the `ProjectOutputs` lib component renders, memoised
 * on `t` so the lib receives a stable labels object between renders.
 */
export const useProjectOutputsLabels = (): ProjectOutputsLabels => {
  const { t } = useTranslation();

  return useMemo<ProjectOutputsLabels>(
    () => ({
      title: t(ProjectsI18nKeys.OutputsTitle),
      seeAllLabel: (count) => t(ProjectsI18nKeys.OutputsSeeAll, { count }),
      showLessLabel: t(ButtonsI18nKeys.ShowLess),
      openOutputLabel: (name) => t(ProjectsI18nKeys.ViewOpenFile, { name }),
      errorLabel: t(ProjectsI18nKeys.OutputsError),
      retryLabel: t(ButtonsI18nKeys.Retry),
    }),
    [t],
  );
};
