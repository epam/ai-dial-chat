import { IconPointFilled } from '@tabler/icons-react';

import classNames from 'classnames';

import { ApplicationStatus } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';

interface FunctionStatusIndicatorProps {
  entity: DialAIEntityModel;
}

export const FunctionStatusIndicator = ({
  entity,
}: FunctionStatusIndicatorProps) =>
  entity.functionStatus ? (
    <IconPointFilled
      size={16}
      className={classNames({
        ['text-accent-secondary']:
          entity.functionStatus === ApplicationStatus.DEPLOYED,
        ['text-error']:
          entity.functionStatus === ApplicationStatus.UNDEPLOYED ||
          entity.functionStatus === ApplicationStatus.FAILED,
        ['text-warning']:
          entity.functionStatus === ApplicationStatus.UNDEPLOYING ||
          entity.functionStatus === ApplicationStatus.DEPLOYING,
      })}
    />
  ) : null;
