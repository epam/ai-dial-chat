import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isQuickApp } from '@/src/utils/app/application';
import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApplicationActionType,
  ApplicationType,
} from '@/src/types/applications';
import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import {
  DeleteType,
  FilterTypes,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ApplicationDialog } from '@/src/components/Common/ApplicationDialog';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { QuickAppDialog } from '@/src/components/Common/QuickAppDialog';
import ApplicationDetails from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { CardsList } from '@/src/components/Marketplace/CardsList';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

import Magnifier from '../../../public/images/icons/search-alt.svg';
import { NoResultsFound } from '../Common/NoResultsFound';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import intersection from 'lodash-es/intersection';
import orderBy from 'lodash-es/orderBy';

const getDeleteConfirmationText = (
  action: DeleteType,
  entity: DialAIEntityModel,
) => {
  const translationVariables = {
    modelName: entity.name,
    modelVersion: entity.version
      ? translate(' (version {{version}})', { version: entity.version })
      : '',
  };

  const deleteConfirmationText = {
    [DeleteType.DELETE]: {
      heading: translate('Confirm deleting application'),
      description: translate(
        'Are you sure you want to delete the {{modelName}}{{modelVersion}}?',
        translationVariables,
      ),
      confirmLabel: translate('Delete'),
    },
    [DeleteType.REMOVE]: {
      heading: translate('Confirm removing application'),
      description: translate(
        'Are you sure you want to remove the {{modelName}}{{modelVersion}} from My workspace?',
        translationVariables,
      ),
      confirmLabel: translate('Remove'),
    },
  };

  return deleteConfirmationText[action];
};

interface TabRendererProps {
  screenState: ScreenState;
}

export const TabRenderer = ({ screenState }: TabRendererProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const [suggestedResults, setSuggestedResults] = useState<
    DialAIEntityModel[] | null
  >(null);
  const [applicationModel, setApplicationModel] = useState<{
    action: ApplicationActionType;
    type: ApplicationType;
    entity?: DialAIEntityModel;
  }>();
  const [deleteModel, setDeleteModel] = useState<{
    action: DeleteType;
    entity: DialAIEntityModel;
  }>();
  const [publishModel, setPublishModel] = useState<{
    entity: ShareEntity & { iconUrl?: string };
    action: PublishActions;
  }>();
  const [detailsModelReference, setDetailsModelReference] = useState<string>();

  const displayedEntities = useMemo(() => {
    const filteredEntities = allModels.filter(
      (entity) =>
        (doesEntityContainSearchTerm(entity, searchTerm) ||
          (entity.version &&
            doesEntityContainSearchTerm(
              { name: entity.version },
              searchTerm,
            ))) &&
        (selectedFilters[FilterTypes.ENTITY_TYPE].length
          ? selectedFilters[FilterTypes.ENTITY_TYPE].includes(entity.type)
          : true) &&
        (selectedFilters[FilterTypes.TOPICS].length
          ? intersection(selectedFilters[FilterTypes.TOPICS], entity.topics)
              .length
          : true),
    );

    const entitiesForTab =
      selectedTab === MarketplaceTabs.MY_APPLICATIONS
        ? filteredEntities.filter((entity) =>
            installedModelIds.has(entity.reference),
          )
        : filteredEntities;

    const shouldSuggest =
      selectedTab === MarketplaceTabs.MY_APPLICATIONS && !entitiesForTab.length;

    const groupedEntities = groupModelsAndSaveOrder(
      shouldSuggest ? filteredEntities : entitiesForTab,
    );
    const orderedEntities = groupedEntities.map(
      ({ entities }) => orderBy(entities, 'version', 'desc')[0],
    );

    setSuggestedResults(shouldSuggest ? orderedEntities : null);

    return orderedEntities;
  }, [installedModelIds, allModels, searchTerm, selectedFilters, selectedTab]);

  const handleAddApplication = useCallback((type: ApplicationType) => {
    setApplicationModel({
      action: ApplicationActionType.ADD,
      type,
    });
  }, []);

  const handleEditApplication = useCallback(
    (entity: DialAIEntityModel) => {
      dispatch(ApplicationActions.get(entity.id));
      setApplicationModel({
        entity,
        action: ApplicationActionType.EDIT,
        type: isQuickApp(entity)
          ? ApplicationType.QUICK_APP
          : ApplicationType.CUSTOM_APP,
      });
    },
    [dispatch],
  );

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && deleteModel) {
        if (deleteModel.action === DeleteType.REMOVE) {
          dispatch(
            ModelsActions.removeInstalledModels({
              references: [deleteModel.entity.reference],
              action: DeleteType.REMOVE,
            }),
          );
        } else if (deleteModel.action === DeleteType.DELETE) {
          dispatch(ApplicationActions.delete(deleteModel.entity));
        }

        setDetailsModelReference(undefined);
      }

      setDeleteModel(undefined);
    },
    [deleteModel, dispatch],
  );

  const handleSetPublishEntity = useCallback(
    (entity: DialAIEntityModel, action: PublishActions) =>
      setPublishModel({
        entity: {
          name: entity.name,
          id: ApiUtils.decodeApiUrl(entity.id),
          folderId: getFolderIdFromEntityId(entity.id),
          iconUrl: entity.iconUrl,
        },
        action,
      }),
    [],
  );

  const handlePublishClose = useCallback(() => setPublishModel(undefined), []);

  const handleDelete = useCallback(
    (entity: DialAIEntityModel) => {
      setDeleteModel({ entity, action: DeleteType.DELETE });
    },
    [setDeleteModel],
  );

  const handleSetDetailsReference = useCallback(
    (entity: DialAIEntityModel) => {
      setDetailsModelReference(entity.reference);
    },
    [setDetailsModelReference],
  );

  const handleCloseApplicationDialog = useCallback(
    () => setApplicationModel(undefined),
    [setApplicationModel],
  );

  const handleCloseDetailsDialog = useCallback(
    () => setDetailsModelReference(undefined),
    [setDetailsModelReference],
  );

  const handleBookmarkClick = useCallback(
    (entity: DialAIEntityModel) => {
      if (installedModelIds.has(entity.reference)) {
        setDeleteModel({ entity, action: DeleteType.REMOVE });
      } else {
        dispatch(
          ModelsActions.addInstalledModels({
            references: [entity.reference],
            showSuccessToast: true,
          }),
        );
      }
    },
    [dispatch, installedModelIds],
  );

  const detailsModel = detailsModelReference
    ? modelsMap[detailsModelReference]
    : undefined;

  return (
    <>
      <header className="mb-6" data-qa="marketplace-header">
        <MarketplaceBanner />
        <SearchHeader
          items={displayedEntities.length}
          onAddApplication={handleAddApplication}
        />
      </header>
      {displayedEntities.length ? (
        <CardsList
          entities={displayedEntities}
          onCardClick={handleSetDetailsReference}
          onPublish={handleSetPublishEntity}
          onDelete={handleDelete}
          onEdit={handleEditApplication}
          isNotDesktop={screenState !== ScreenState.DESKTOP}
          onBookmarkClick={handleBookmarkClick}
        />
      ) : (
        <>
          {selectedTab === MarketplaceTabs.MY_APPLICATIONS &&
          suggestedResults?.length ? (
            <>
              <div className="mb-8 flex items-center gap-1">
                <Magnifier height={32} width={32} className="text-secondary" />
                <span className="text-base">
                  {t(
                    'No results found in My workspace. Look at suggested results from DIAL Marketplace.',
                  )}
                </span>
              </div>
              <span className="text-xl">
                {t('Suggested results from DIAL Marketplace')}
              </span>
              <CardsList
                entities={suggestedResults}
                onCardClick={handleSetDetailsReference}
                onPublish={handleSetPublishEntity}
                onDelete={handleDelete}
                onEdit={handleEditApplication}
                isNotDesktop={screenState !== ScreenState.DESKTOP}
                onBookmarkClick={handleBookmarkClick}
              />
            </>
          ) : (
            <div className="flex grow flex-col items-center justify-center">
              <NoResultsFound iconSize={100} className="gap-5 text-lg" />
              <span className="mt-4 text-sm">
                {t("Sorry, we couldn't find any results for your search.")}
              </span>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      {!!(
        applicationModel && applicationModel.type === ApplicationType.CUSTOM_APP
      ) && (
        <ApplicationDialog
          isOpen={!!applicationModel}
          isEdit={applicationModel.action === ApplicationActionType.EDIT}
          currentReference={applicationModel.entity?.reference}
          onClose={handleCloseApplicationDialog}
        />
      )}
      {!!(
        applicationModel && applicationModel.type === ApplicationType.QUICK_APP
      ) && (
        <QuickAppDialog
          isOpen={!!applicationModel}
          isEdit={applicationModel.action === ApplicationActionType.EDIT}
          currentReference={applicationModel.entity?.reference}
          onClose={handleCloseApplicationDialog}
        />
      )}
      {!!deleteModel && (
        <ConfirmDialog
          isOpen={!!deleteModel}
          {...getDeleteConfirmationText(deleteModel.action, deleteModel.entity)}
          onClose={handleDeleteClose}
          cancelLabel={t('Cancel')}
        />
      )}
      {detailsModel && (
        <ApplicationDetails
          onPublish={handleSetPublishEntity}
          isMobileView={screenState === ScreenState.MOBILE}
          entity={detailsModel}
          onChangeVersion={handleSetDetailsReference}
          onClose={handleCloseDetailsDialog}
          onDelete={handleDelete}
          onEdit={handleEditApplication}
          onBookmarkClick={handleBookmarkClick}
          allEntities={allModels}
          isMyAppsTab={selectedTab === MarketplaceTabs.MY_APPLICATIONS}
        />
      )}
      {!!(publishModel && publishModel?.entity?.id) && (
        <PublishModal
          entity={publishModel.entity}
          type={SharingType.Application}
          isOpen={!!publishModel}
          onClose={handlePublishClose}
          publishAction={publishModel.action}
        />
      )}
    </>
  );
};
