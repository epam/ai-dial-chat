import { useTranslation } from '@/src/hooks/useTranslation';

import { ApplicationStatus } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { Badge } from '@/src/components/Badge';

interface FunctionStatusIndicatorProps {
  entity: DialAIEntityModel;
}

const getLabel = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return MarketplaceI18nKeys.Undeployed;
    case ApplicationStatus.DEPLOYED:
      return MarketplaceI18nKeys.Deployed;
    case ApplicationStatus.DEPLOYING:
      return MarketplaceI18nKeys.DeployingMarketplace;
    case ApplicationStatus.REDEPLOYING:
      return MarketplaceI18nKeys.RedeployingMarketplace;
    case ApplicationStatus.UNDEPLOYING:
      return MarketplaceI18nKeys.UndeployingMarketplace;
    default:
      return '';
  }
};

const getBadgeType = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return 'error';
    case ApplicationStatus.DEPLOYING:
    case ApplicationStatus.UNDEPLOYING:
    case ApplicationStatus.REDEPLOYING:
      return 'warning';
    case ApplicationStatus.DEPLOYED:
    default:
      return 'success';
  }
};

export const FunctionStatusIndicator = ({
  entity,
}: FunctionStatusIndicatorProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  return entity.functionStatus ? (
    <div>
      <Badge
        label={t(getLabel(entity))}
        type={getBadgeType(entity)}
        className="shrink-0"
      />
    </div>
  ) : null;
};
