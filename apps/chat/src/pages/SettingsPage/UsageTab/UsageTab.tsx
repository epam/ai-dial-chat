import { useUsageData } from '@epam/ai-dial-chat-hooks';
import {
  mapOverallCostLimitsToPeriodStatuses,
  mapUsageDataToDashboard,
  mapUserUsageToModelLimits,
} from '@epam/ai-dial-chat-hooks/usage';
import { Spinner } from '@epam/ai-dial-ui-kit';
import {
  ModelLimitsSection,
  UsageLimitCardGroup,
} from '@epam/ai-dial-usage-dashboard';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { UsageI18nKeys } from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { useLanguage } from '../../../hooks/language/useLanguage';
import { getUserUsage } from '../../../server-api/user-limits';
import { resolveCatalogIconUrl } from '../../../utils/icon-path';
import { resolveLocalizedText } from '../../../utils/locale';
import { formatUsageResetTime } from '../../../utils/usage-reset-time';

/*
 * Small grace period so DIAL Core has rolled the window over before the
 * refresh request is sent.
 */
const RESET_SETTLE_MS = 5_000;

/*
 * `setTimeout`'s 32-bit ceiling. A month boundary can exceed it, and an
 * unclamped delay overflows and fires immediately — which would produce a
 * re-fetch storm rather than a single refresh. When clamped, the timer re-arms
 * on wake instead of re-fetching.
 */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

const UsageTab: FC = () => {
  const { t } = useTranslation() as {
    t: (s: string, params?: Record<string, unknown>) => string;
  };
  const { language: activeLocale } = useLanguage();
  const { showErrorNotification } = useNotification();
  const [refreshToken, setRefreshToken] = useState(0);
  const {
    usage,
    isLoading: isUsageLoading,
    usageError,
  } = useUsageData(getUserUsage, true, refreshToken);
  const { items: deploymentItems, isLoading: isDeploymentsLoading } =
    useDeployments();
  /*
   * Keyed on the initial load only: a boundary-triggered refresh must not
   * replace the whole tab with a spinner, which would flash the figures away.
   */
  const isLoading = (isUsageLoading && usage == null) || isDeploymentsLoading;

  const requestRefresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (usageError == null) return;

    showErrorNotification({ message: t(UsageI18nKeys.FullLoadError) });
  }, [usageError, showErrorNotification, t]);

  const labels = useMemo(
    () => ({
      defaultBadgeLabel: t(UsageI18nKeys.DefaultBadgeLabel),
      runningLowBadgeLabel: t(UsageI18nKeys.RunningLowBadgeLabel),
      limitReachedBadgeLabel: t(UsageI18nKeys.LimitReachedBadgeLabel),
      usedOfTotalLabel: ({ total }: { total: string }) =>
        t(UsageI18nKeys.UsedOfTotalLabel, { total }),
      remainingCaptionLabel: ({ remaining }: { remaining: string }) =>
        t(UsageI18nKeys.RemainingCaptionLabel, { remaining }),
      usedPercentLabel: ({ percent }: { percent: number }) =>
        t(UsageI18nKeys.UsedPercentLabel, { percent: Math.round(percent) }),
    }),
    [t],
  );

  /*
   * Kept `useCallback`-stable: it is passed into mappers that sit behind
   * `useMemo`, so an unstable identity would recompute both on every render.
   */
  const formatResetTime = useCallback(
    (resetsAt: string | undefined) =>
      formatUsageResetTime(resetsAt, activeLocale, t),
    [activeLocale, t],
  );

  const cards = useMemo(
    () => mapUsageDataToDashboard(usage, t, formatResetTime),
    [usage, t, formatResetTime],
  );

  /*
   * Every parsed reset boundary among the displayed cards, ascending, read
   * from each card's `resetIsoValue`. `UsageLimitCardData` carries only the
   * three preformatted display strings by design, so the epoch value is parsed
   * here at the application edge rather than threaded through the library.
   *
   * This stays pure — the clock is only read inside the effects below, which
   * is what decides whether a boundary is still in the future.
   */
  const resetBoundariesMs = useMemo(
    () =>
      cards
        .map((card) =>
          card.resetIsoValue != null ? Date.parse(card.resetIsoValue) : NaN,
        )
        .filter((ms) => !Number.isNaN(ms))
        .sort((first, second) => first - second),
    [cards],
  );

  /*
   * The future boundary the timer is currently armed for, so a wake-up check
   * can tell an elapsed boundary from one that was already past when the
   * response arrived — the latter arms nothing and must not trigger a refresh.
   */
  const armedBoundaryRef = useRef<number | undefined>(undefined);

  /*
   * Arms one timer for the earliest future boundary. On fire it bumps
   * `refreshToken`, which re-runs the hook's fetch — nothing here zeroes a
   * `used`, restores a `total`, or synthesizes any post-reset state. Figures
   * are only ever replaced by a resolved `getUserUsage()` response.
   */
  useEffect(() => {
    const earliestResetMs = resetBoundariesMs.find((ms) => ms > Date.now());
    armedBoundaryRef.current = earliestResetMs;

    if (earliestResetMs == null) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const arm = () => {
      const remaining = earliestResetMs - Date.now() + RESET_SETTLE_MS;
      if (remaining <= 0) {
        requestRefresh();
        return;
      }

      const isClamped = remaining > MAX_TIMEOUT_MS;
      timeoutId = setTimeout(
        isClamped ? arm : requestRefresh,
        isClamped ? MAX_TIMEOUT_MS : remaining,
      );
    };

    arm();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [resetBoundariesMs, requestRefresh]);

  /*
   * A suspended device may have fired the timer late or not at all, so
   * re-check on wake. The armed boundary is cleared once used, so one elapsed
   * boundary triggers exactly one refresh.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const boundary = armedBoundaryRef.current;
      if (boundary != null && Date.now() >= boundary) {
        armedBoundaryRef.current = undefined;
        requestRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestRefresh]);

  const modelLimitsLabels = useMemo(
    () => ({
      headingLabel: t(UsageI18nKeys.ModelLimitsHeading),
      itemColumnLabel: t(UsageI18nKeys.ItemColumnLabel),
      dayColumnLabel: t(UsageI18nKeys.TodayPeriodDescription),
      weekColumnLabel: t(UsageI18nKeys.ThisWeekPeriodDescription),
      monthColumnLabel: t(UsageI18nKeys.ThisMonthPeriodDescription),
      statusColumnLabel: t(UsageI18nKeys.StatusColumnLabel),
      tokensLabel: t(UsageI18nKeys.TokensColumnLabel),
      costLabel: t(UsageI18nKeys.CostColumnLabel),
      modelTypeLabel: t(UsageI18nKeys.ModelTypeLabel),
      noLimitLabel: t(UsageI18nKeys.NoLimitLabel),
      unavailableLabel: t(UsageI18nKeys.UnavailableLabel),
      withinLimitsBadgeLabel: t(UsageI18nKeys.DefaultBadgeLabel),
      runningLowBadgeLabel: t(UsageI18nKeys.RunningLowBadgeLabel),
      limitReachedBadgeLabel: t(UsageI18nKeys.LimitReachedBadgeLabel),
      noLimitBadgeLabel: t(UsageI18nKeys.NoLimitLabel),
      unavailableBadgeLabel: t(UsageI18nKeys.UnavailableBadgeLabel),
      emptyStateLabel: t(UsageI18nKeys.ModelLimitsEmptyState),
    }),
    [t],
  );

  const modelLimitRows = useMemo(
    () =>
      mapUserUsageToModelLimits(
        usage,
        deploymentItems,
        activeLocale,
        t,
        resolveCatalogIconUrl,
        resolveLocalizedText,
      ),
    [usage, deploymentItems, activeLocale, t],
  );
  const modelLimitPeriodStatuses = useMemo(
    () =>
      mapOverallCostLimitsToPeriodStatuses(
        usage,
        activeLocale,
        t,
        formatResetTime,
      ),
    [usage, activeLocale, t, formatResetTime],
  );

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 px-8 py-3">
        <h2 className="dial-h1-text m-0 text-primary">
          {t(UsageI18nKeys.PageTitle)}
        </h2>
        <p className="dial-small-text m-0 text-secondary">
          {t(UsageI18nKeys.PageDescription)}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-4">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner fullWidth={false} ariaLabel={t(UsageI18nKeys.Loading)} />
          </div>
        ) : (
          <>
            <UsageLimitCardGroup cards={cards} labels={labels} />
            <ModelLimitsSection
              rows={modelLimitRows}
              labels={modelLimitsLabels}
              periodStatuses={modelLimitPeriodStatuses}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default memo(UsageTab);
