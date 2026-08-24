import { Spinner } from '@epam/ai-dial-ui-kit';
import {
  ModelLimitsPeriod,
  ModelLimitsSection,
  UsageLimitCardGroup,
} from '@epam/ai-dial-usage-dashboard';
import { memo, useEffect, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { UsageI18nKeys } from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { useLanguage } from '../../../hooks/language/useLanguage';
import { useUsageData } from '../../../hooks/useUsageData';
import { mapUsageDataToDashboard } from '../../../utils/map-usage-data-to-dashboard';
import { mapUserUsageToModelLimits } from '../../../utils/map-user-usage-to-model-limits';

const UsageTab: FC = () => {
  const { t } = useTranslation();
  const { language: activeLocale } = useLanguage();
  const { showErrorNotification } = useNotification();
  const isSettingsPageEnabled = useFeatureFlag('settingsPageEnabled');
  const {
    usage,
    isLoading: isUsageLoading,
    usageError,
  } = useUsageData(isSettingsPageEnabled);
  const { items: deploymentItems, isLoading: isDeploymentsLoading } =
    useDeployments();
  const [period, setPeriod] = useState(ModelLimitsPeriod.Last24Hours);
  const isLoading = isUsageLoading || isDeploymentsLoading;

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

  const cards = useMemo(() => mapUsageDataToDashboard(usage, t), [usage, t]);

  const modelLimitsLabels = useMemo(
    () => ({
      headingLabel: t(UsageI18nKeys.ModelLimitsHeading),
      periodLabels: {
        [ModelLimitsPeriod.LastMinute]: t(UsageI18nKeys.PeriodLastMinuteLabel),
        [ModelLimitsPeriod.LastHour]: t(UsageI18nKeys.PeriodLastHourLabel),
        [ModelLimitsPeriod.Last24Hours]: t(
          UsageI18nKeys.TodayPeriodDescription,
        ),
        [ModelLimitsPeriod.Last7Days]: t(
          UsageI18nKeys.ThisWeekPeriodDescription,
        ),
        [ModelLimitsPeriod.Last30Days]: t(
          UsageI18nKeys.ThisMonthPeriodDescription,
        ),
      },
      periodSelectorAriaLabel: t(UsageI18nKeys.PeriodSelectorAriaLabel),
      itemColumnLabel: t(UsageI18nKeys.ItemColumnLabel),
      costColumnLabel: t(UsageI18nKeys.CostColumnLabel),
      tokensColumnLabel: t(UsageI18nKeys.TokensColumnLabel),
      requestsColumnLabel: t(UsageI18nKeys.RequestsColumnLabel),
      statusColumnLabel: t(UsageI18nKeys.StatusColumnLabel),
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
        period,
        activeLocale,
        t,
      ),
    [usage, deploymentItems, period, activeLocale, t],
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
              period={period}
              onPeriodChange={setPeriod}
              labels={modelLimitsLabels}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default memo(UsageTab);
