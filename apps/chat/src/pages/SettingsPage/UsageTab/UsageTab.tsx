import { Spinner } from '@epam/ai-dial-ui-kit';
import {
  ModelLimitsSection,
  UsageLimitCardGroup,
} from '@epam/ai-dial-usage-dashboard';
import { memo, useEffect, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { UsageI18nKeys } from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { useLanguage } from '../../../hooks/language/useLanguage';
import { useUsageData } from '../../../hooks/useUsageData';
import { mapUsageDataToDashboard } from '../../../utils/map-usage-data-to-dashboard';
import {
  mapOverallCostLimitsToPeriodStatuses,
  mapUserUsageToModelLimits,
} from '../../../utils/map-user-usage-to-model-limits';

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
      itemColumnLabel: t(UsageI18nKeys.ItemColumnLabel),
      last24HoursColumnLabel: t(UsageI18nKeys.TodayPeriodDescription),
      last7DaysColumnLabel: t(UsageI18nKeys.ThisWeekPeriodDescription),
      last30DaysColumnLabel: t(UsageI18nKeys.ThisMonthPeriodDescription),
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
    () => mapUserUsageToModelLimits(usage, deploymentItems, activeLocale, t),
    [usage, deploymentItems, activeLocale, t],
  );
  const modelLimitPeriodStatuses = useMemo(
    () => mapOverallCostLimitsToPeriodStatuses(usage, activeLocale, t),
    [usage, activeLocale, t],
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
