import { useCallback, useMemo, useState } from 'react';

import { ApplicationActionType } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import { ApplicationDialog } from '@/src/components/Common/ApplicationDialog';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { CardsList } from '@/src/components/Marketplace/CardsList';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

enum DeleteType {
  DELETE,
  REMOVE,
}

const deleteConfirmationText = {
  [DeleteType.DELETE]: {
    heading: 'Confirm deleting application',
    description: 'Are you sure you want to delete the application?',
    confirmLabel: 'Delete',
  },
  [DeleteType.REMOVE]: {
    heading: 'Confirm removing application',
    description:
      'Are you sure you want to remove the application from your list?',
    confirmLabel: 'Remove',
  },
};

interface TabRendererProps {
  entities: DialAIEntityModel[];
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  isMobile?: boolean;
}

export const TabRenderer = ({
  entities,
  onCardClick,
  onPublish,
  isMobile,
}: TabRendererProps) => {
  const dispatch = useAppDispatch();

  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const [applicationModel, setApplicationModel] = useState<{
    action: ApplicationActionType;
    entity?: DialAIEntityModel;
  }>();
  const [deleteModel, setDeleteModel] = useState<{
    action: DeleteType;
    entity: DialAIEntityModel;
  }>();

  const handleAddApplication = useCallback(() => {
    setApplicationModel({
      action: ApplicationActionType.ADD,
    });
  }, []);

  const handleEditApplication = useCallback(
    (entity: DialAIEntityModel) => {
      dispatch(ApplicationActions.get(entity.id));
      setApplicationModel({
        entity,
        action: ApplicationActionType.EDIT,
      });
    },
    [dispatch],
  );

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && deleteModel) {
        if (deleteModel.action === DeleteType.REMOVE) {
          const filteredModels = installedModels.filter(
            (model) => deleteModel.entity.id !== model.id,
          );
          dispatch(ModelsActions.updateInstalledModels(filteredModels));
        }
        if (deleteModel.action === DeleteType.DELETE) {
          dispatch(ApplicationActions.delete(deleteModel.entity));
        }
      }
      setDeleteModel(undefined);
    },
    [deleteModel, installedModels, dispatch],
  );

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
          onAddApplication={handleAddApplication}
        />
      </header>

      <CardsList
        title={
          selectedTab === MarketplaceTabs.HOME ? 'All applications' : undefined
        }
        entities={filteredModels}
        onCardClick={onCardClick}
        onPublish={onPublish}
        onDelete={(entity) =>
          setDeleteModel({ entity, action: DeleteType.DELETE })
        }
        onRemove={(entity) =>
          setDeleteModel({ entity, action: DeleteType.REMOVE })
        }
        onEdit={handleEditApplication}
        isMobile={isMobile}
      />

      {/* MODALS */}
      {!!applicationModel && (
        <ApplicationDialog
          isOpen={!!applicationModel}
          isEdit={applicationModel.action === ApplicationActionType.EDIT}
          currentReference={applicationModel.entity?.reference}
          onClose={() => setApplicationModel(undefined)}
        />
      )}
      {!!deleteModel && (
        <ConfirmDialog
          isOpen={!!deleteModel}
          {...deleteConfirmationText[deleteModel.action]}
          onClose={handleDeleteClose}
          cancelLabel="Cancel"
        />
      )}
    </>
  );
};
