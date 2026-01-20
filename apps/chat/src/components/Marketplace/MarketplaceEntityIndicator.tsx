import { isDialAiEntityModel } from '@/src/utils/app/application';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { CredentialsStatusIndicator } from '@/src/components/Marketplace/CredentialsStatusIndicator';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

interface MarketplaceEntityIndicatorProps {
  entity: MarketplaceEntity;
  isDetailedView?: boolean;
}

export const MarketplaceEntityIndicator = ({
  entity,
  isDetailedView,
}: MarketplaceEntityIndicatorProps) => {
  if (isDialAiEntityModel(entity)) {
    return <FunctionStatusIndicator entity={entity} />;
  }

  if (isToolsetEntityModel(entity)) {
    return (
      <CredentialsStatusIndicator
        entity={entity}
        showAdditionalBadge={isDetailedView}
      />
    );
  }

  return null;
};
