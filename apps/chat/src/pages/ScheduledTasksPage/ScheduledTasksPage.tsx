import {
  OfflineCredentialsGateStatus,
  OfflineCredentialsLoginOutcomeType,
} from '@epam/ai-dial-chat-hooks';
import {
  ScheduledTasks,
  ScheduledTasksSortKey,
  type ScheduledTasksStyles,
} from '@epam/ai-dial-scheduled-tasks';
import { LiveRegion, LiveRegionElement } from '@epam/ai-dial-ui-kit';
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
import ScheduledTasksLimitedAccessBanner from '../../components/ScheduledTasksLimitedAccessBanner/ScheduledTasksLimitedAccessBanner';
import ScheduledTasksLoginBanner, {
  ScheduledTasksLoginBannerState,
} from '../../components/ScheduledTasksLoginBanner/ScheduledTasksLoginBanner';
import { getScheduledTaskDetailRoute } from '../../constants/routes';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useOfflineCredentialsAuth } from '../../hooks/offlineCredentials/useOfflineCredentialsAuth';
import { useOfflineCredentialsGate } from '../../hooks/offlineCredentials/useOfflineCredentialsGate';
import { useScheduledTasks } from '../../hooks/scheduled-tasks/useScheduledTasks';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapScheduledTaskDtosToItems } from '../../utils/map-scheduled-task-dto';
import { OFFLINE_CREDENTIALS_LOGIN_ANNOUNCEMENT_KEYS } from '../../utils/offline-credentials-announcements';
import { isSchedulerConsentMissing } from '../../utils/scheduler-consent';
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

/* The page header: a 40px title row over a
   small-text description, as on the other pages. */
const PAGE_STYLES: ScheduledTasksStyles = {
  typography: {
    titleClassName: 'dial-h1-text flex min-h-10 items-center',
    /* `!mt-0.5` replaces the library's 4px gap under the title with the 2px used on the other pages. */
    subtitleClassName: 'dial-small-text !mt-0.5',
  },
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
    schedulerServiceConsent,
    refetch: refetchCredentials,
  } = useOfflineCredentialsGate();
  const { isLoggingIn, loginOutcome, logIn } = useOfflineCredentialsAuth({
    connect,
    refetch: refetchCredentials,
  });

  /*
   * The shared auth hook is outcome-based (the lib holds no i18n), so the
   * page maps the terminal login outcome onto the polite announcement text
   * both surfaces announce; a new attempt resets the outcome, and the
   * announcement with it.
   */
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  useEffect(() => {
    setLiveAnnouncement(
      loginOutcome != null
        ? t(OFFLINE_CREDENTIALS_LOGIN_ANNOUNCEMENT_KEYS[loginOutcome])
        : '',
    );
  }, [loginOutcome, t]);

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

  /*
   * Consent is evaluated before the login state: with the scheduler service
   * consent missing, neither logging in nor logging out can restore it, so
   * the create action withdraws and the limited-access banner replaces the
   * login banner. `unknown` (a failed consent read) fails open.
   */
  const isLimitedAccess = isSchedulerConsentMissing(schedulerServiceConsent);

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
      emptyStateDescription: t(ScheduledTasksI18nKeys.EmptyStateDescription),
      noResultsLabel: t(ScheduledTasksI18nKeys.ListNoResultsLabel),
      noResultsDescription: t(BasicI18nKeys.NoResultsDescription),
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

  /* No banner has visible content (the connected/checking/error gate
   * states): the login banner would render only its sr-only status span,
   * and passing it into the banner slot keeps that slot as an in-flow flex
   * child that adds a gap between the toolbar and the content, so the
   * hidden banner's live region renders at page level instead, outside the
   * lib's layout entirely — while a visible banner renders, its own
   * aria-live region carries the announcements. The page-level span stays
   * mounted (empty while the banner owns announcements) because a live
   * region that mounts in the same render as its text is announced
   * unreliably. */
  const isBannerSlotEmpty = !isLimitedAccess && bannerState == null;

  return (
    <>
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {isBannerSlotEmpty ? liveAnnouncement : ''}
      </LiveRegion>
      <ScheduledTasks
        labels={labels}
        styles={PAGE_STYLES}
        onCreateClick={isLimitedAccess ? undefined : handleCreateClick}
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
          isLimitedAccess ? (
            <ScheduledTasksLimitedAccessBanner
              title={t(ScheduledTasksI18nKeys.LimitedAccessBannerTitle)}
              body={t(ScheduledTasksI18nKeys.LimitedAccessBannerBody)}
            />
          ) : bannerState != null ? (
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
          ) : undefined
        }
      />
    </>
  );
};

export default memo(ScheduledTasksPage);
