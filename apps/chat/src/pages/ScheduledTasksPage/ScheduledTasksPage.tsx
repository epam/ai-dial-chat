import {
  ScheduledTasks,
  ScheduledTasksSortKey,
} from '@epam/ai-dial-scheduled-tasks';
import { memo, useCallback, useEffect, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { ScheduledTaskCreateQuery } from '../../constants/scheduled-tasks';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useScheduledTasks } from '../../hooks/scheduled-tasks/useScheduledTasks';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapScheduledTaskDtosToItems } from '../../utils/map-scheduled-task-dto';
import NotFoundPage from '../NotFound/NotFound';

interface NavigationState {
  refresh?: boolean;
}

const ScheduledTasksPage: FC = () => {
  const { t } = useTranslation();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const {
    items: taskDtos,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  } = useScheduledTasks(isEnabled);

  useEffect(() => {
    const state = location.state as NavigationState | null;
    if (state?.refresh) {
      refetch();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, refetch]);

  const handleCreateClick = useCallback(() => {
    const params = new URLSearchParams({
      [ScheduledTaskCreateQuery.ReturnUrl]: ROUTES.ScheduledTasks,
    });
    navigate(`${ROUTES.ScheduledTaskCreate}?${params.toString()}`);
  }, [navigate]);

  const labels = useMemo(
    () => ({
      title: t(ScheduledTasksI18nKeys.PageTitle),
      subtitle: t(ScheduledTasksI18nKeys.PageSubtitle),
      createButtonLabel: t(ScheduledTasksI18nKeys.CreateButtonLabel),
      searchPlaceholder: t(ScheduledTasksI18nKeys.SearchPlaceholder),
      searchAriaLabel: t(ScheduledTasksI18nKeys.SearchAriaLabel),
      clearSearchLabel: t(ScheduledTasksI18nKeys.ClearSearchLabel),
      sortLabel: t(ScheduledTasksI18nKeys.SortLabel),
      sortOptions: [
        {
          key: ScheduledTasksSortKey.FirstToRun,
          label: t(ScheduledTasksI18nKeys.SortFirstToRun),
        },
        {
          key: ScheduledTasksSortKey.LastToRun,
          label: t(ScheduledTasksI18nKeys.SortLastToRun),
        },
        {
          key: ScheduledTasksSortKey.Newest,
          label: t(ScheduledTasksI18nKeys.SortNewest),
        },
        {
          key: ScheduledTasksSortKey.NameAZ,
          label: t(ScheduledTasksI18nKeys.SortNameAZ),
        },
      ],
      emptyStateLabel: t(ScheduledTasksI18nKeys.EmptyStateLabel),
      noResultsLabel: t(ScheduledTasksI18nKeys.ListNoResultsLabel),
      errorLabel: t(ScheduledTasksI18nKeys.ListErrorLabel),
      retryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      sharedSectionTitle: t(ScheduledTasksI18nKeys.ListSharedSectionTitle),
      loadingMoreLabel: t(ScheduledTasksI18nKeys.ListLoadingMoreLabel),
      cardLabels: {
        newBadgeLabel: t(ScheduledTasksI18nKeys.CardNewBadgeLabel),
        actionsLabel: t(ScheduledTasksI18nKeys.CardActionsLabel),
        editActionLabel: t(ScheduledTasksI18nKeys.CardEditActionLabel),
        runNowActionLabel: t(ScheduledTasksI18nKeys.CardRunNowActionLabel),
        deleteActionLabel: t(ScheduledTasksI18nKeys.CardDeleteActionLabel),
      },
    }),
    [t],
  );

  const items = useMemo(
    () => mapScheduledTaskDtosToItems(taskDtos, t, user?.sub),
    [taskDtos, t, user?.sub],
  );

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  return (
    // onEdit/onRunNow/onDelete are intentionally omitted: the overflow menu,
    // edit flow, and run-now action are deferred to a future iteration.
    <ScheduledTasks
      labels={labels}
      onCreateClick={handleCreateClick}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      sortKey={sortKey}
      onSortChange={setSortKey}
      items={items}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
    />
  );
};

export default memo(ScheduledTasksPage);
