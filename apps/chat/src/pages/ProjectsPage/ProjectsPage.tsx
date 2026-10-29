import {
  Projects,
  ProjectSource,
  ProjectsSortKey,
  type ProjectsLabels,
} from '@epam/ai-dial-projects';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { getProjectViewRoute } from '../../constants/routes';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useUserConfig } from '../../context/UserConfigContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useProjects } from '../../hooks/projects/useProjects';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import NotFoundPage from '../NotFound/NotFound';

const ProjectsPage: FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const { projects, incompleteSources, isLoading, hasError, retry } =
    useProjects(isEnabled);
  const { pinnedProjectIds } = useUserConfig();
  const projectItems = useMemo(() => {
    const pinned = new Set(pinnedProjectIds);
    return projects.map((project) =>
      pinned.has(project.id) ? { ...project, isPinned: true } : project,
    );
  }, [projects, pinnedProjectIds]);

  const navigate = useNavigate();
  const handleCreateProject = useCallback(
    () => navigate(ROUTES.ProjectCreate),
    [navigate],
  );
  const handleOpenProject = useCallback(
    (id: string) => navigate(getProjectViewRoute(id)),
    [navigate],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(ProjectsSortKey.Newest);

  const labels = useMemo<ProjectsLabels>(
    () => ({
      title: t(ProjectsI18nKeys.PageTitle),
      searchPlaceholder: t(ProjectsI18nKeys.SearchPlaceholder),
      searchAriaLabel: t(ProjectsI18nKeys.SearchAriaLabel),
      clearSearchLabel: t(BasicI18nKeys.ClearSearch),
      sortLabel: t(ButtonsI18nKeys.Sort),
      sortOptions: [
        {
          value: ProjectsSortKey.Newest,
          label: t(ProjectsI18nKeys.SortNewest),
        },
        {
          value: ProjectsSortKey.Oldest,
          label: t(ProjectsI18nKeys.SortOldest),
        },
        {
          value: ProjectsSortKey.NameAsc,
          label: t(ProjectsI18nKeys.SortNameAsc),
        },
      ],
      emptyStateLabel: t(ProjectsI18nKeys.EmptyStateLabel),
      emptyStateDescription: t(ProjectsI18nKeys.EmptyStateDescription),
      noResultsLabel: t(ProjectsI18nKeys.NoResultsLabel),
      errorLabel: t(ProjectsI18nKeys.ErrorLabel),
      incompleteLabel: t(ProjectsI18nKeys.IncompleteLabel),
      retryLabel: t(ButtonsI18nKeys.Retry),
      sourceLabels: {
        [ProjectSource.Personal]: t(ProjectsI18nKeys.SourcePersonal),
        [ProjectSource.Shared]: t(ProjectsI18nKeys.SourceShared),
        [ProjectSource.Organization]: t(ProjectsI18nKeys.SourceOrganization),
      },
      resultCountLabel: (count: number) =>
        t(ProjectsI18nKeys.ResultCount, { count }),
      folderPathLabel: t(ProjectsI18nKeys.CardFolderPath),
      createProjectLabel: t(ProjectsI18nKeys.PageNewProject),
      pinnedLabel: t(ProjectsI18nKeys.CardPinned),
    }),
    [t],
  );

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  return (
    <Projects
      projects={projectItems}
      isLoading={isLoading}
      hasError={hasError}
      incompleteSources={incompleteSources}
      onRetry={retry}
      onCreateProject={handleCreateProject}
      onOpenProject={handleOpenProject}
      getProjectHref={getProjectViewRoute}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      sortKey={sortKey}
      onSortKeyChange={setSortKey}
      labels={labels}
      locale={language}
    />
  );
};

export default memo(ProjectsPage);
