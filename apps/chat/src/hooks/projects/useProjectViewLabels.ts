import type { ProjectViewLabels } from '@epam/ai-dial-projects';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  NavigationI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';

/**
 * Resolves every string the `ProjectView` lib component renders. Kept out
 * of the page so the page reads as wiring, and memoised on `t` so the lib
 * receives a stable labels object between renders.
 */
export const useProjectViewLabels = (): ProjectViewLabels => {
  const { t } = useTranslation();

  return useMemo<ProjectViewLabels>(
    () => ({
      backLabel: t(NavigationI18nKeys.Back),
      pinLabel: t(ButtonsI18nKeys.Pin),
      publishLabel: t(ButtonsI18nKeys.Publish),
      editLabel: t(ButtonsI18nKeys.Edit),
      moreActionsLabel: t(ButtonsI18nKeys.MoreActions),
      shareLabel: t(ButtonsI18nKeys.Share),
      downloadLabel: t(ButtonsI18nKeys.Download),
      deleteLabel: t(ButtonsI18nKeys.Delete),
      detailsLabel: t(ProjectsI18nKeys.ViewDetails),
      descriptionLabel: t(ProjectsI18nKeys.ViewDescription),
      instructionsLabel: t(ProjectsI18nKeys.ViewInstructions),
      contextLabel: t(ProjectsI18nKeys.ViewContext),
      contextSearchPlaceholder: t(
        ProjectsI18nKeys.ViewContextSearchPlaceholder,
      ),
      contextSearchAriaLabel: t(ProjectsI18nKeys.ViewContextSearchAriaLabel),
      clearSearchLabel: t(BasicI18nKeys.ClearSearch),
      contextResultCountLabel: (count: number) =>
        t(ProjectsI18nKeys.ViewContextResultCount, { count }),
      emptyContextLabel: t(ProjectsI18nKeys.ViewEmptyContext),
      noContextMatchesLabel: t(ProjectsI18nKeys.ViewNoContextMatches),
      openFileLabel: (name: string) =>
        t(ProjectsI18nKeys.ViewOpenFile, { name }),
      errorLabel: t(ProjectsI18nKeys.ViewError),
      retryLabel: t(ButtonsI18nKeys.Retry),
      notFoundLabel: t(ProjectsI18nKeys.ViewNotFound),
      browseProjectsLabel: t(ProjectsI18nKeys.ViewBrowseProjects),
    }),
    [t],
  );
};
