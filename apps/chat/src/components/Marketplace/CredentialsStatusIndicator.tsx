import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetSignedIn, isToolsetWithAuth } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Badge } from '@/src/components/Badge';
import { Tooltip } from '@/src/components/Common/Tooltip';

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

  if (!isToolsetWithAuth(entity)) {
    return null;
  }

  return (
    <Tooltip
      tooltip={isSignedIn ? 'Signed In' : 'Signed Out'}
      isTriggerClickable
      triggerClassName="flex shrink-0"
    >
      <Badge
        label={t(label)}
        type={isSignedIn ? 'success' : 'error'}
        className="shrink-0"
      />
    </Tooltip>
  );
};
