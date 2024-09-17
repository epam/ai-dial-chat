import { useMemo, useState } from 'react';

import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import { ApplicationDialog } from '@/src/components/Common/ApplicationDialog';
import { CardsList } from '@/src/components/Marketplace/CardsList';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

interface TabRendererProps {
  entities: DialAIEntityModel[];
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  isMobile?: boolean;
}

export const TabRenderer = ({
  entities,
  onCardClick,
  onPublish,
  onDelete,
  isMobile,
}: TabRendererProps) => {
  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const [addModal, setAddModal] = useState(false);

  const filteredModels = useMemo(() => {
    if (selectedTab === MarketplaceTabs.MY_APPLICATIONS) {
      return entities.filter(
        (entity) => !!installedModels.find((model) => model.id === entity.id),
      );
    }
    return entities;
  }, [selectedTab, entities, installedModels]);

  return (
    <>
      <header className="mb-4">
        <MarketplaceBanner />
        <SearchHeader
          items={filteredModels.length}
          onAddApplication={() => setAddModal(true)}
        />
      </header>

      <CardsList
        title={
          selectedTab === MarketplaceTabs.HOME ? 'All applications' : undefined
        }
        entities={filteredModels}
        onCardClick={onCardClick}
        onPublish={onPublish}
        onDelete={onDelete}
        isMobile={isMobile}
      />

      {addModal && (
        <ApplicationDialog
          isOpen={addModal}
          onClose={() => setAddModal(false)}
        />
      )}
    </>
  );
};
