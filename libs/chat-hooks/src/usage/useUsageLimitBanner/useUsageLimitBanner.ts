import {
  UsageLimitBannerSeverity,
  type UsageLimitBannerViewProps,
} from '@epam/ai-dial-conversation-input';
import { useCallback, useMemo } from 'react';
import { selectUsageBannerSource } from '../usage-banner-source';
import { UsagePeriod } from '../usage-period';
import { type TranslateFn, formatUsageResetShort } from '../usage-reset-time';
import {
  type GetDeploymentLimits,
  useDeploymentUsageLimits,
} from '../useDeploymentUsageLimits/useDeploymentUsageLimits';
import { useRefreshUsageAfterGeneration } from '../useRefreshUsageAfterGeneration/useRefreshUsageAfterGeneration';
import { useUsageLimitBannerDismissal } from '../useUsageLimitBannerDismissal/useUsageLimitBannerDismissal';

/**
 * i18n key strings the consuming app's translation bundle must define for
 * `useUsageLimitBanner` to produce translated strings, in addition to
 * `USAGE_RESET_I18N_KEYS`. The values are the default key paths used by AI
 * DIAL Chat.
 */
export const USAGE_BANNER_I18N_KEYS = {
  /** Warning sentence for a daily limit. Receives `{ percent: number }`. */
  warningDay: 'conversationInput.usageBanner.warningDay',
  /** Warning sentence for a weekly limit. Receives `{ percent: number }`. */
  warningWeek: 'conversationInput.usageBanner.warningWeek',
  /** Warning sentence for a monthly limit. Receives `{ percent: number }`. */
  warningMonth: 'conversationInput.usageBanner.warningMonth',
  /** Reached sentence for a daily limit. Receives `{ percent: number }`. */
  reachedDay: 'conversationInput.usageBanner.reachedDay',
  /** Reached sentence for a weekly limit. Receives `{ percent: number }`. */
  reachedWeek: 'conversationInput.usageBanner.reachedWeek',
  /** Reached sentence for a monthly limit. Receives `{ percent: number }`. */
  reachedMonth: 'conversationInput.usageBanner.reachedMonth',
  /** Accessible name of the close button. */
  closeLabel: 'conversationInput.usageBanner.closeLabel',
} as const;

const PERIOD_SENTENCE_KEYS: Record<
  UsageLimitBannerSeverity,
  Record<UsagePeriod, string>
> = {
  [UsageLimitBannerSeverity.Warning]: {
    [UsagePeriod.Day]: USAGE_BANNER_I18N_KEYS.warningDay,
    [UsagePeriod.Week]: USAGE_BANNER_I18N_KEYS.warningWeek,
    [UsagePeriod.Month]: USAGE_BANNER_I18N_KEYS.warningMonth,
  },
  [UsageLimitBannerSeverity.Reached]: {
    [UsagePeriod.Day]: USAGE_BANNER_I18N_KEYS.reachedDay,
    [UsagePeriod.Week]: USAGE_BANNER_I18N_KEYS.reachedWeek,
    [UsagePeriod.Month]: USAGE_BANNER_I18N_KEYS.reachedMonth,
  },
};

/** Inputs of {@link useUsageLimitBanner}. */
export interface UseUsageLimitBannerOptions {
  /** ID of the currently selected deployment. */
  deploymentId: string | undefined;
  /** Whether the selected deployment is currently generating a response. Defaults to `false`. */
  isGenerationInProgress?: boolean;
  /** Host-configured call that fetches one deployment's limits. */
  getDeploymentLimits: GetDeploymentLimits;
  /** Used percentage at or above which a not-yet-exhausted limit raises a warning. */
  warningThresholdPercent: number;
  /** Active UI locale, used to format the reset time. */
  activeLocale: string;
  /** Translate function compatible with i18next's `TFunction`. */
  t: TranslateFn;
}

/** The part of `UsageLimitBannerViewProps` the hook decides. */
export type UsageLimitBannerState = Pick<
  UsageLimitBannerViewProps,
  'severity' | 'limitText' | 'reset' | 'onClose' | 'closeAriaLabel'
>;

/** Return shape of {@link useUsageLimitBanner}. */
export interface UseUsageLimitBannerResult {
  /** Props for `UsageLimitBannerView`, or `undefined` when no banner should render (no deployment, below the threshold, or dismissed). */
  banner: UsageLimitBannerState | undefined;
}

/**
 * Everything the composer usage banner needs except its rendering: fetches the
 * selected deployment's limits, refreshes them after each generation, picks
 * the limit worth reporting, formats its sentences, and tracks tab-lifetime
 * dismissal. Spread `banner` onto `UsageLimitBannerView` from
 * `@epam/ai-dial-conversation-input`.
 */
export const useUsageLimitBanner = ({
  deploymentId,
  isGenerationInProgress = false,
  getDeploymentLimits,
  warningThresholdPercent,
  activeLocale,
  t,
}: UseUsageLimitBannerOptions): UseUsageLimitBannerResult => {
  const { limitsDto, isLoading, refresh } = useDeploymentUsageLimits(
    deploymentId,
    getDeploymentLimits,
  );
  const { isDismissed, dismiss } = useUsageLimitBannerDismissal();

  useRefreshUsageAfterGeneration({
    isGenerationInProgress,
    isLoading,
    refresh,
  });

  const source = useMemo(
    () => selectUsageBannerSource(limitsDto, warningThresholdPercent),
    [limitsDto, warningThresholdPercent],
  );

  const display = useMemo(() => {
    if (source == null || !deploymentId) {
      return undefined;
    }

    return {
      dismissalKey: `${deploymentId}:${source.period}:${source.severity}`,
      limitText: t(PERIOD_SENTENCE_KEYS[source.severity][source.period], {
        percent: source.usedPercent,
      }),
      reset: formatUsageResetShort(
        source.resetsAt,
        source.period,
        activeLocale,
        t,
      ),
    };
  }, [source, deploymentId, activeLocale, t]);

  const dismissalKey = display?.dismissalKey;
  const onClose = useCallback(() => {
    if (dismissalKey != null) {
      dismiss(dismissalKey);
    }
  }, [dismiss, dismissalKey]);

  const closeAriaLabel = t(USAGE_BANNER_I18N_KEYS.closeLabel);

  const banner = useMemo<UsageLimitBannerState | undefined>(() => {
    if (
      source == null ||
      display == null ||
      isDismissed(display.dismissalKey)
    ) {
      return undefined;
    }

    return {
      severity: source.severity,
      limitText: display.limitText,
      reset: display.reset,
      onClose,
      closeAriaLabel,
    };
  }, [source, display, isDismissed, onClose, closeAriaLabel]);

  return { banner };
};
