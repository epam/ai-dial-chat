import {
  UsageLimitBannerSeverity,
  UsageLimitBannerView,
} from '@epam/ai-dial-conversation-input';
import { type FC, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ConversationInputUsageBannerI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useDeploymentUsageLimits } from '../../hooks/useDeploymentUsageLimits';
import { useRefreshUsageAfterGeneration } from '../../hooks/useRefreshUsageAfterGeneration';
import { useUsageLimitBannerDismissal } from '../../hooks/useUsageLimitBannerDismissal';
import { UsagePeriod } from '../../types/usage-limits';
import { selectUsageBannerSource } from '../../utils/usage-limits';
import { formatUsageResetShort } from '../../utils/usage-reset-time';

interface Props {
  /** ID of the currently selected deployment. */
  deploymentId: string | undefined;
  /** Whether the selected deployment is currently generating a response. */
  isGenerationInProgress?: boolean;
}

const PERIOD_SENTENCE_KEYS: Record<
  UsageLimitBannerSeverity,
  Record<UsagePeriod, ConversationInputUsageBannerI18nKeys>
> = {
  [UsageLimitBannerSeverity.Warning]: {
    [UsagePeriod.Day]: ConversationInputUsageBannerI18nKeys.WarningDay,
    [UsagePeriod.Week]: ConversationInputUsageBannerI18nKeys.WarningWeek,
    [UsagePeriod.Month]: ConversationInputUsageBannerI18nKeys.WarningMonth,
  },
  [UsageLimitBannerSeverity.Reached]: {
    [UsagePeriod.Day]: ConversationInputUsageBannerI18nKeys.ReachedDay,
    [UsagePeriod.Week]: ConversationInputUsageBannerI18nKeys.ReachedWeek,
    [UsagePeriod.Month]: ConversationInputUsageBannerI18nKeys.ReachedMonth,
  },
};

const UsageLimitBanner: FC<Props> = ({
  deploymentId,
  isGenerationInProgress = false,
}) => {
  /* Widened to the plain key/params signature `formatUsageResetShort` takes,
     matching `UsageLimitsControl`'s own cast. */
  const { t } = useTranslation() as {
    t: (key: string, params?: Record<string, unknown>) => string;
  };
  const { language: activeLocale } = useLanguage();
  const {
    config: { usageLimitsWarningThresholdPercent },
  } = useAppConfig();
  const { limitsDto, isLoading, refresh } =
    useDeploymentUsageLimits(deploymentId);
  const { isDismissed, dismiss } = useUsageLimitBannerDismissal();

  useRefreshUsageAfterGeneration({
    isGenerationInProgress,
    isLoading,
    refresh,
  });

  const source = useMemo(
    () =>
      selectUsageBannerSource(limitsDto, usageLimitsWarningThresholdPercent),
    [limitsDto, usageLimitsWarningThresholdPercent],
  );

  const display = useMemo(() => {
    if (source == null || !deploymentId) {
      return undefined;
    }

    return {
      dismissalKey: `${deploymentId}:${source.period}:${source.severity}`,
      periodSentence: t(PERIOD_SENTENCE_KEYS[source.severity][source.period], {
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
  const handleClose = useCallback(() => {
    if (dismissalKey != null) {
      dismiss(dismissalKey);
    }
  }, [dismiss, dismissalKey]);

  if (source == null || display == null || isDismissed(display.dismissalKey)) {
    return null;
  }

  return (
    <UsageLimitBannerView
      severity={source.severity}
      limitText={display.periodSentence}
      reset={display.reset}
      onClose={handleClose}
      closeAriaLabel={t(ConversationInputUsageBannerI18nKeys.CloseLabel)}
    />
  );
};

export default memo(UsageLimitBanner);
