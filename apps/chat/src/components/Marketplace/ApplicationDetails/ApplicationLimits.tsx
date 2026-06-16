import { IconInfinity } from '@tabler/icons-react';
import { FC, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { DialAIEntityModel, LimitUsage } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { Loader } from '@/src/components/Common/Loader';
import { RatingProgressBar } from '@/src/components/Marketplace/Rating/RatingProgressBar';

const isUnlimitedUsage = ({ total }: LimitUsage) => {
  const unlimitedThreshold = 9e18;

  return total >= unlimitedThreshold;
};

const formatLimit = (limit: number) => Intl.NumberFormat('ru-RU').format(limit);

interface LimitItemProps {
  limit: LimitUsage;
  title: string;
}

const LimitItem: FC<LimitItemProps> = ({ limit, title }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h4 className="text-sm text-primary">{title}</h4>

        <div className="flex items-center gap-1 text-xs text-secondary">
          <span>{formatLimit(limit.used)}</span>
          <span>/</span>
          <span>
            {isUnlimitedUsage(limit) ? (
              <IconInfinity size={18} />
            ) : (
              formatLimit(limit.total)
            )}
          </span>
        </div>
      </div>

      <RatingProgressBar
        total={limit.total}
        count={limit.used}
        progressClassName="!bg-accent-primary"
        wrapperClassName="!bg-layer-1"
      />
    </div>
  );
};

interface ApplicationLimitsViewProps {
  limits: (LimitUsage & { title: string })[];
}

const ApplicationLimitsView: FC<ApplicationLimitsViewProps> = ({ limits }) => {
  return (
    <div className="flex flex-col gap-5 ps-7">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        {limits.map((limit) => (
          <LimitItem key={limit.title} limit={limit} title={limit.title} />
        ))}
      </div>
    </div>
  );
};

interface ApplicationLimitsProps {
  entity: DialAIEntityModel;
}

export const ApplicationLimits: FC<ApplicationLimitsProps> = ({ entity }) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isLimitsLoading = useAppSelector(
    ModelsSelectors.selectUsageStatsLoading,
  );
  const limits = useAppSelector((state) =>
    ModelsSelectors.selectUsageStatsById(state, entity.id),
  );

  const filteredLimits = useMemo(
    () =>
      limits
        ? [
            {
              ...limits.minuteTokenStats,
              title: t(MarketplaceI18nKeys.Minute),
            },
            {
              ...limits.weekTokenStats,
              title: t(MarketplaceI18nKeys.Weekly),
            },
            {
              ...limits.dayTokenStats,
              title: t(MarketplaceI18nKeys.Daily),
            },
            {
              ...limits.monthTokenStats,
              title: t(MarketplaceI18nKeys.Monthly),
            },
          ].filter((limit) => !isUnlimitedUsage(limit))
        : [],
    [limits, t],
  );

  if (!isLimitsLoading && !limits) return null;

  return (
    <CollapsibleSection
      name={t(MarketplaceI18nKeys.TokenLimits)}
      openByDefault={false}
      togglerClassName="!text-base font-semibold !text-primary"
      className="!p-0"
      caretIconClassName="!text-primary"
      caretIconArrowView
      caretIconSize={20}
    >
      {isLimitsLoading ? (
        <Loader />
      ) : filteredLimits.length ? (
        <ApplicationLimitsView limits={filteredLimits} />
      ) : (
        <span className="ps-7 text-base text-secondary">
          {t(MarketplaceI18nKeys.NoLimitsApplied)}
        </span>
      )}
    </CollapsibleSection>
  );
};
