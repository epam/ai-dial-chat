import classNames from 'classnames';

import { useToolsetCredentialsLevel } from '@/src/hooks/useToolsetCredentialsLevel';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';

import { Tooltip } from '@/src/components/Common/Tooltip';

import IconKey from '@/public/images/icons/key.svg';
import { ToolsetAuthStatus, ToolsetAuthTypes } from '@epam/ai-dial-shared';

interface CredentialsStatusIndicatorProps {
  entity: ToolsetModel;
  level?: ToolsetCredentialsLevel;
}

export const CredentialsStatusIndicator = ({
  entity,
  level,
}: CredentialsStatusIndicatorProps) => {
  const credentialsLevel = useToolsetCredentialsLevel();

  const isSignedIn =
    entity.authSettings.authStatus[level ?? credentialsLevel] ===
    ToolsetAuthStatus.SIGNED_IN;

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
