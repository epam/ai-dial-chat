import {
  ScheduledTasks,
  ScheduledTasksSortKey,
} from '@epam/ai-dial-scheduled-tasks';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import ScheduledTasksLoginBanner, {
  ScheduledTasksLoginBannerState,
} from '../../components/ScheduledTasksLoginBanner/ScheduledTasksLoginBanner';
import { getScheduledTaskDetailRoute } from '../../constants/routes';
import { ScheduledTaskCreateQuery } from '../../constants/scheduled-tasks';
import {
  ButtonsI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
} from '../../hooks/offlineCredentials/useOfflineCredentialsGate';
import {
  OfflineCredentialsLoginOutcomeType,
  useOfflineCredentialsLogin,
} from '../../hooks/offlineCredentials/useOfflineCredentialsLogin';
import { useScheduledTasks } from '../../hooks/scheduled-tasks/useScheduledTasks';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapScheduledTaskDtosToItems } from '../../utils/map-scheduled-task-dto';
import NotFoundPage from '../NotFound/NotFound';

interface NavigationState {
  refresh?: boolean;
}

const resolveBannerState = ({
  isLoggingIn,
  retryState,
  status,
}: {
  isLoggingIn: boolean;
  retryState: ScheduledTasksLoginBannerState | undefined;
  status: OfflineCredentialsGateStatus;
}): ScheduledTasksLoginBannerState | undefined => {
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
    error,
    hasMore,
    loadMore,
    refetch,
  } = useScheduledTasks(isEnabled);

  const {
    status: credentialsStatus,
    connect,
    refetch: refetchCredentials,
  } = useOfflineCredentialsGate();
  const { login } = useOfflineCredentialsLogin();
  const [retryState, setRetryState] = useState<
    ScheduledTasksLoginBannerState | undefined
  >(undefined);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

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

  const handleCardClick = useCallback(
    (id: string) => {
      navigate(getScheduledTaskDetailRoute(id));
    },
    [navigate],
  );

  const handleLogIn = useCallback(() => {
    if (!connect) return;
    setIsLoggingIn(true);
    setRetryState(undefined);
    setLiveAnnouncement('');

    const run = async (): Promise<void> => {
      const outcome = await login(connect, refetchCredentials);
      setIsLoggingIn(false);

      switch (outcome.type) {
        case OfflineCredentialsLoginOutcomeType.Success:
          setLiveAnnouncement(
            t(
              ScheduledTasksI18nKeys.OfflineCredentialsBannerSuccessAnnouncement,
            ),
          );
          setRetryState(undefined);
          break;
        case OfflineCredentialsLoginOutcomeType.PopupBlocked:
          setRetryState(ScheduledTasksLoginBannerState.RetryPopupBlocked);
          break;
        case OfflineCredentialsLoginOutcomeType.Cancelled:
          setRetryState(ScheduledTasksLoginBannerState.RetryCancelled);
          break;
        case OfflineCredentialsLoginOutcomeType.TimedOut:
          setRetryState(ScheduledTasksLoginBannerState.RetryTimeout);
          break;
        case OfflineCredentialsLoginOutcomeType.Failure:
        default:
          setRetryState(ScheduledTasksLoginBannerState.RetryFailed);
          break;
      }
    };
    void run();
  }, [connect, login, refetchCredentials, t]);

  const bannerState = resolveBannerState({
    isLoggingIn,
    retryState,
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
      cardLabels: {
        newBadgeLabel: t(ScheduledTasksI18nKeys.CardNewBadgeLabel),
      },
    }),
    [t],
  );

  const items = useMemo(
    () => mapScheduledTaskDtosToItems(taskDtos, t),
    [taskDtos, t],
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
      onLoadMore={loadMore}
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
          onLogIn={connect ? handleLogIn : undefined}
        />
      }
    />
  );
};

export default memo(ScheduledTasksPage);
