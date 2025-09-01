import { isDialAiEntityModel } from '@/src/utils/app/application';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';

import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { CredentialsStatusIndicator } from '@/src/components/Marketplace/CredentialsStatusIndicator';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

interface MarketplaceEntityIndicatorProps {
  entity: MarketplaceEntity;
}

export const MarketplaceEntityIndicator = ({
  entity,
}: MarketplaceEntityIndicatorProps) => {
  const entitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  if (
    entitiesTab === MarketplaceEntitiesTabs.AGENTS &&
    isDialAiEntityModel(entity)
  ) {
    return <FunctionStatusIndicator entity={entity} />;
  }

  if (
    entitiesTab === MarketplaceEntitiesTabs.TOOLSETS &&
    isToolsetEntityModel(entity)
  ) {
    return <CredentialsStatusIndicator entity={entity} />;
  }

  return null;
};
