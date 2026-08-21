import { UsageLimitCardGroup } from '@epam/ai-dial-usage-dashboard';
import { memo, useEffect, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { UsageI18nKeys } from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useNotification } from '../../../context/NotificationContext';
import { useUsageData } from '../../../hooks/useUsageData';
import { mapUsageDataToDashboard } from '../../../utils/map-usage-data-to-dashboard';

const UsageTab: FC = () => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const isSettingsPageEnabled = useFeatureFlag('settingsPageEnabled');
  const { limits, usage, isLoading, limitsError, usageError } = useUsageData(
    isSettingsPageEnabled,
  );

  useEffect(() => {
    if (limitsError == null && usageError == null) return;

    if (limitsError != null && usageError != null) {
      showErrorNotification({ message: t(UsageI18nKeys.FullLoadError) });
    } else {
      showErrorNotification({ message: t(UsageI18nKeys.PartialLoadError) });
    }
  }, [limitsError, usageError, showErrorNotification, t]);

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

  const cards = useMemo(
    () => mapUsageDataToDashboard(limits, usage, t),
    [limits, usage, t],
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
      <span role="status" aria-live="polite" className="sr-only">
        {isLoading ? t(UsageI18nKeys.Loading) : undefined}
      </span>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-4">
        {!isLoading && <UsageLimitCardGroup cards={cards} labels={labels} />}
      </div>
    </div>
  );
};

export default memo(UsageTab);
