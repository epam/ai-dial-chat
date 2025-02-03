import { IconPointFilled } from '@tabler/icons-react';

import classNames from 'classnames';

import { ApplicationStatus } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';

import Tooltip from '../Common/Tooltip';

interface FunctionStatusIndicatorProps {
  entity: DialAIEntityModel;
}

const getFunctionTooltip = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return 'Undeployed';
    case ApplicationStatus.DEPLOYED:
      return 'Deployed';
    case ApplicationStatus.DEPLOYING:
      return 'Deploying';
    case ApplicationStatus.UNDEPLOYING:
      return 'Undeploying';
    default:
      return '';
  }
};

export const FunctionStatusIndicator = ({
  entity,
}: FunctionStatusIndicatorProps) =>
  entity.functionStatus ? (
    <Tooltip tooltip={getFunctionTooltip(entity)} isTriggerClickable>
      <IconPointFilled
        size={20}
        className={classNames({
          ['text-accent-secondary']:
            entity.functionStatus === ApplicationStatus.DEPLOYED,
          ['text-error']:
            entity.functionStatus === ApplicationStatus.UNDEPLOYED ||
            entity.functionStatus === ApplicationStatus.FAILED,
          ['animate-pulse text-warning']:
            entity.functionStatus === ApplicationStatus.UNDEPLOYING ||
            entity.functionStatus === ApplicationStatus.DEPLOYING,
        })}
      />
    </Tooltip>
  ) : null;
