import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetSignedIn, isToolsetWithAuth } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Badge } from '@/src/components/Badge';
import { isPredefinedEntity } from '@/src/utils/app/id';

interface CredentialsStatusIndicatorProps {
  entity: ToolsetModel;
  showAdditionalBadge?: boolean;
}

export const CredentialsStatusIndicator = ({
  entity,
  showAdditionalBadge,
}: CredentialsStatusIndicatorProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isSignedInGlobal = isToolsetSignedIn(entity);
  const isSignedInUser = isToolsetSignedIn(
    entity,
    ToolsetCredentialsLevel.USER,
  );
  const isPublic = isEntityIdPublic(entity) || isPredefinedEntity(entity);
  const isSignedIn = isSignedInUser || isSignedInGlobal;

  const loginLabel = isSignedInUser || !isPublic ? 'MY CREDS' : 'ORG CREDS';
  const label = isSignedIn ? loginLabel : 'LOGGED OUT';
  const additionalBadge =
    isPublic && isSignedInGlobal && isSignedInUser && 'ORG CREDS';

  if (!isToolsetWithAuth(entity)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <Badge
        label={t(label)}
        type={isSignedIn ? 'success' : 'error'}
        className="shrink-0"
      />
      {showAdditionalBadge && additionalBadge && (
        <Badge
          label={t(additionalBadge)}
          type="disabled"
          className="shrink-0"
        />
      )}
    </div>
  );
};
