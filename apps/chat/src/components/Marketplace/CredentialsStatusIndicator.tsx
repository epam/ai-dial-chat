import classNames from 'classnames';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';

import { Tooltip } from '@/src/components/Common/Tooltip';

import IconKey from '@/public/images/icons/key.svg';
import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

interface CredentialsStatusIndicatorProps {
  entity: ToolsetModel;
}

export const CredentialsStatusIndicator = ({
  entity,
}: CredentialsStatusIndicatorProps) => {
  const isSignedInGlobal = isToolsetSignedIn(entity);
  const isSignedInUser = isToolsetSignedIn(
    entity,
    ToolsetCredentialsLevel.USER,
  );
  const isSignedIn = isSignedInUser || isSignedInGlobal;

  if (entity.authSettings.authenticationType === ToolsetAuthTypes.NONE) {
    return null;
  }

  return (
    <Tooltip
      tooltip={isSignedIn ? 'Signed In' : 'Signed Out'}
      isTriggerClickable
    >
      <IconKey
        className={classNames(
          'ml-2',
          isSignedIn ? 'text-success' : 'text-error',
        )}
        width={18}
        height={18}
      />
    </Tooltip>
  );
};
