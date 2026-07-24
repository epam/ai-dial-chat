import { ScheduledTasks } from '@epam/ai-dial-scheduled-tasks';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScheduledTaskCreateQuery } from '../../constants/scheduled-tasks';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useScheduledTasks } from '../../hooks/scheduled-tasks/useScheduledTasks';
import { ROUTES } from '../../types/routes';
import { mapScheduledTaskDtosToItems } from '../../utils/map-scheduled-task-dto';
import NotFoundPage from '../NotFound/NotFound';

interface NavigationState {
  refresh?: boolean;
}

const ScheduledTasksPage: FC = () => {
  const { t } = useTranslation();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const {
    items: taskDtos,
    isLoading,
    error,
    refetch,
  } = useScheduledTasks(isEnabled);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('firstToRun');

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

  const texts = useMemo(
    () => ({
      title: t(ScheduledTasksI18nKeys.PageTitle),
      subtitle: t(ScheduledTasksI18nKeys.PageSubtitle),
      createButtonLabel: t(ScheduledTasksI18nKeys.CreateButtonLabel),
      searchPlaceholder: t(ScheduledTasksI18nKeys.SearchPlaceholder),
      searchAriaLabel: t(ScheduledTasksI18nKeys.SearchAriaLabel),
      clearSearchLabel: t(ScheduledTasksI18nKeys.ClearSearchLabel),
      sortLabel: t(ScheduledTasksI18nKeys.SortLabel),
      sortOptions: [
        { key: 'firstToRun', label: t(ScheduledTasksI18nKeys.SortFirstToRun) },
        { key: 'lastToRun', label: t(ScheduledTasksI18nKeys.SortLastToRun) },
        { key: 'newest', label: t(ScheduledTasksI18nKeys.SortNewest) },
        { key: 'nameAZ', label: t(ScheduledTasksI18nKeys.SortNameAZ) },
      ],
      emptyStateLabel: t(ScheduledTasksI18nKeys.EmptyStateLabel),
      noResultsLabel: t(ScheduledTasksI18nKeys.ListNoResultsLabel),
      errorLabel: t(ScheduledTasksI18nKeys.ListErrorLabel),
      retryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      sharedSectionTitle: t(ScheduledTasksI18nKeys.ListSharedSectionTitle),
      myTasksSectionTitle: t(ScheduledTasksI18nKeys.ListMyTasksSectionTitle),
      cardNewBadgeLabel: t(ScheduledTasksI18nKeys.CardNewBadgeLabel),
      cardActionsLabel: t(ScheduledTasksI18nKeys.CardActionsLabel),
      cardEditActionLabel: t(ScheduledTasksI18nKeys.CardEditActionLabel),
      cardRunNowActionLabel: t(ScheduledTasksI18nKeys.CardRunNowActionLabel),
      cardDeleteActionLabel: t(ScheduledTasksI18nKeys.CardDeleteActionLabel),
    }),
    [t],
  );

  const items = useMemo(
    () => mapScheduledTaskDtosToItems(taskDtos, t, user?.sub),
    [taskDtos, t, user?.sub],
  );

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  return (
    <ScheduledTasks
      texts={texts}
      onCreateClick={handleCreateClick}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      sortKey={sortKey}
      onSortChange={setSortKey}
      items={items}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
    />
  );
};

export default memo(ScheduledTasksPage);
