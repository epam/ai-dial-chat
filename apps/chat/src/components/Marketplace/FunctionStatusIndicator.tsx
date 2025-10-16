import { useTranslation } from '@/src/hooks/useTranslation';

import { ApplicationStatus } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { Badge } from '@/src/components/Badge';
import { Tooltip } from '@/src/components/Common/Tooltip';

interface FunctionStatusIndicatorProps {
  entity: DialAIEntityModel;
}

const getLabel = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return 'Undeployed';
    case ApplicationStatus.DEPLOYED:
      return 'Deployed';
    case ApplicationStatus.DEPLOYING:
    case ApplicationStatus.REDEPLOYING:
      return 'Deploying';
    case ApplicationStatus.UNDEPLOYING:
      return 'Undeploying';
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
    <Tooltip
      tooltip={getLabel(entity)}
      isTriggerClickable
      triggerClassName="flex"
    >
      <Badge label={t(getLabel(entity))} type={getBadgeType(entity)} />
    </Tooltip>
  ) : null;
};
