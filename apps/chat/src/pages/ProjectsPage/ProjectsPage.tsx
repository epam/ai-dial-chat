import {
  Projects,
  ProjectSource,
  ProjectsSortKey,
  type ProjectsLabels,
} from '@epam/ai-dial-projects';
import { memo, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useProjects } from '../../hooks/projects/useProjects';
import { UserConfigStatus } from '../../types/user-config-status';
import NotFoundPage from '../NotFound/NotFound';

const ProjectsPage: FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const { projects, incompleteSources, isLoading, hasError, retry } =
    useProjects(isEnabled);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(ProjectsSortKey.Newest);

  const formatUpdatedAt = useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(language, {
      dateStyle: 'medium',
    });
    return (timestamp: number) =>
      t(ProjectsI18nKeys.CardUpdatedAt, {
        date: dateFormat.format(timestamp),
      });
  }, [language, t]);

  const labels = useMemo<ProjectsLabels>(
    () => ({
      title: t(ProjectsI18nKeys.PageTitle),
      subtitle: t(ProjectsI18nKeys.PageSubtitle),
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
      projects={projects}
      isLoading={isLoading}
      hasError={hasError}
      incompleteSources={incompleteSources}
      onRetry={retry}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      sortKey={sortKey}
      onSortKeyChange={setSortKey}
      formatUpdatedAt={formatUpdatedAt}
      labels={labels}
      locale={language}
    />
  );
};

export default memo(ProjectsPage);
