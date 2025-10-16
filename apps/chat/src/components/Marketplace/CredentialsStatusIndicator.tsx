import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Badge } from '@/src/components/Badge';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

interface CredentialsStatusIndicatorProps {
  entity: ToolsetModel;
}

export const CredentialsStatusIndicator = ({
  entity,
}: CredentialsStatusIndicatorProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isSignedInGlobal = isToolsetSignedIn(entity);
  const isSignedInUser = isToolsetSignedIn(
    entity,
    ToolsetCredentialsLevel.USER,
  );
  const isPublic = isEntityIdPublic(entity);
  const isSignedIn = isSignedInUser || isSignedInGlobal;

  const loginLabel = isSignedInUser || !isPublic ? 'MY CREDS' : 'ORG CREDS';
  const label = isSignedIn ? loginLabel : 'LOGGED OUT';

  if (entity.authSettings.authenticationType === ToolsetAuthTypes.NONE) {
    return null;
  }

  return (
    <Tooltip
      tooltip={isSignedIn ? 'Signed In' : 'Signed Out'}
      isTriggerClickable
      triggerClassName="flex"
    >
      <Badge label={t(label)} type={isSignedIn ? 'success' : 'error'} />
    </Tooltip>
  );
};
