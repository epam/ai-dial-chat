import {
  ScheduledTasks,
  ScheduledTasksSortKey,
} from '@epam/ai-dial-scheduled-tasks';
import { memo, useCallback, useEffect, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import ScheduledTasksLoginBanner, {
  ScheduledTasksLoginBannerState,
} from '../../components/ScheduledTasksLoginBanner/ScheduledTasksLoginBanner';
import { getScheduledTaskDetailRoute } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useOfflineCredentialsAuth } from '../../hooks/offlineCredentials/useOfflineCredentialsAuth';
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
} from '../../hooks/offlineCredentials/useOfflineCredentialsGate';
import { OfflineCredentialsLoginOutcomeType } from '../../hooks/offlineCredentials/useOfflineCredentialsLogin';
import { useScheduledTasks } from '../../hooks/scheduled-tasks/useScheduledTasks';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapScheduledTaskDtosToItems } from '../../utils/map-scheduled-task-dto';
import NotFoundPage from '../NotFound/NotFound';

interface NavigationState {
  refresh?: boolean;
}

/*
 * Banner retry presentation for each terminal login outcome — every outcome
 * other than Success (which the authoritative gate refetch resolves to a
 * hidden banner).
 */
const RETRY_BANNER_STATES: Partial<
  Record<OfflineCredentialsLoginOutcomeType, ScheduledTasksLoginBannerState>
> = {
  [OfflineCredentialsLoginOutcomeType.PopupBlocked]:
    ScheduledTasksLoginBannerState.RetryPopupBlocked,
  [OfflineCredentialsLoginOutcomeType.Cancelled]:
    ScheduledTasksLoginBannerState.RetryCancelled,
  [OfflineCredentialsLoginOutcomeType.TimedOut]:
    ScheduledTasksLoginBannerState.RetryTimeout,
  [OfflineCredentialsLoginOutcomeType.Failure]:
    ScheduledTasksLoginBannerState.RetryFailed,
};

const resolveBannerState = ({
  isLoggingIn,
  loginOutcome,
  status,
}: {
  isLoggingIn: boolean;
  loginOutcome: OfflineCredentialsLoginOutcomeType | undefined;
  status: OfflineCredentialsGateStatus;
}): ScheduledTasksLoginBannerState | undefined => {
  const retryState =
    loginOutcome != null ? RETRY_BANNER_STATES[loginOutcome] : undefined;
  if (isLoggingIn) return ScheduledTasksLoginBannerState.LoginInProgress;
  if (retryState) return retryState;
  if (
    status === OfflineCredentialsGateStatus.Available ||
    status === OfflineCredentialsGateStatus.Unavailable
  ) {
    return ScheduledTasksLoginBannerState.Shown;
  }
  return undefined;
};

const ScheduledTasksPage: FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const location = useLocation();

  const {
    items: taskDtos,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    isLoading,
    isLoadingMore,
    loadMoreError,
    error,
    hasMore,
    loadMore,
    retryLoadMore,
    refetch,
  } = useScheduledTasks(isEnabled);

  const {
    status: credentialsStatus,
    connect,
    refetch: refetchCredentials,
  } = useOfflineCredentialsGate();
  const { isLoggingIn, loginOutcome, liveAnnouncement, logIn } =
    useOfflineCredentialsAuth({
      connect,
      refetch: refetchCredentials,
    });

  useEffect(() => {
    const state = location.state as NavigationState | null;
    if (state?.refresh) {
      refetch();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, refetch]);

  const handleCreateClick = useCallback(() => {
    navigate(ROUTES.ScheduledTaskCreate);
  }, [navigate]);

  const handleCardClick = useCallback(
    (id: string) => {
      navigate(getScheduledTaskDetailRoute(id));
    },
    [navigate],
  );

  const bannerState = resolveBannerState({
    isLoggingIn,
    loginOutcome,
    status: credentialsStatus,
  });

  const labels = useMemo(
    () => ({
      title: t(ScheduledTasksI18nKeys.PageTitle),
      subtitle: t(ScheduledTasksI18nKeys.PageSubtitle),
      createButtonLabel: t(ScheduledTasksI18nKeys.CreateButtonLabel),
      searchPlaceholder: t(ScheduledTasksI18nKeys.SearchPlaceholder),
      searchAriaLabel: t(ScheduledTasksI18nKeys.SearchAriaLabel),
      clearSearchLabel: t(ScheduledTasksI18nKeys.ClearSearchLabel),
      sortLabel: t(ButtonsI18nKeys.Sort),
      sortOptions: [
        {
          value: ScheduledTasksSortKey.FirstToRun,
          label: t(ScheduledTasksI18nKeys.SortFirstToRun),
        },
        {
          value: ScheduledTasksSortKey.LastToRun,
          label: t(ScheduledTasksI18nKeys.SortLastToRun),
        },
        {
          value: ScheduledTasksSortKey.Newest,
          label: t(ScheduledTasksI18nKeys.SortNewest),
        },
        {
          value: ScheduledTasksSortKey.NameAZ,
          label: t(ScheduledTasksI18nKeys.SortNameAZ),
        },
      ],
      emptyStateLabel: t(ScheduledTasksI18nKeys.EmptyStateLabel),
      noResultsLabel: t(ScheduledTasksI18nKeys.ListNoResultsLabel),
      errorLabel: t(ScheduledTasksI18nKeys.ListErrorLabel),
      retryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      loadingMoreLabel: t(ScheduledTasksI18nKeys.ListLoadingMoreLabel),
      loadMoreErrorLabel: t(ScheduledTasksI18nKeys.ListLoadMoreErrorLabel),
      cardLabels: {
        newBadgeLabel: t(ScheduledTasksI18nKeys.CardNewBadgeLabel),
        pausedBadgeLabel: t(ScheduledTasksI18nKeys.CardPausedBadgeLabel),
        completedBadgeLabel: t(ScheduledTasksI18nKeys.CardCompletedBadgeLabel),
      },
    }),
    [t],
  );

  const items = useMemo(
    () => mapScheduledTaskDtosToItems(taskDtos, t, language),
    [taskDtos, t, language],
  );

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  return (
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
      loadMoreError={loadMoreError}
      onLoadMore={loadMore}
      onRetryLoadMore={retryLoadMore}
      onCardClick={handleCardClick}
      banner={
        <ScheduledTasksLoginBanner
          state={bannerState}
          title={t(ScheduledTasksI18nKeys.OfflineCredentialsBannerTitle)}
          body={t(ScheduledTasksI18nKeys.OfflineCredentialsBannerBody)}
          loginButtonLabel={t(ButtonsI18nKeys.LogIn)}
          retryButtonLabel={t(ButtonsI18nKeys.Retry)}
          loggingInLabel={t(
            ScheduledTasksI18nKeys.OfflineCredentialsBannerLoggingInLabel,
          )}
          popupBlockedMessage={t(
            ScheduledTasksI18nKeys.OfflineCredentialsBannerPopupBlockedMessage,
          )}
          cancelledMessage={t(
            ScheduledTasksI18nKeys.OfflineCredentialsBannerCancelledMessage,
          )}
          timeoutMessage={t(
            ScheduledTasksI18nKeys.OfflineCredentialsBannerTimeoutMessage,
          )}
          failedMessage={t(
            ScheduledTasksI18nKeys.OfflineCredentialsBannerFailedMessage,
          )}
          liveAnnouncement={liveAnnouncement}
          onLogIn={connect ? logIn : undefined}
        />
      }
    />
  );
};

export default memo(ScheduledTasksPage);
