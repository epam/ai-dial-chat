import { IconMessage2 } from '@tabler/icons-react';
import { memo, useCallback, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getApplicationType } from '@/src/utils/app/application';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { groupModelsAndSaveOrder } from '@/src/utils/app/models';
import { translate } from '@/src/utils/app/translation';
import {
  doesApplicationMatchFilters,
  doesApplicationMatchSearchTerm,
} from '@/src/utils/marketplace';
import { ApiUtils } from '@/src/utils/server/api';

import { DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.reducer';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import {
  DeleteType,
  FilterTypes,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { ApplicationDetails } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

import { NoResultsFound } from '../Common/NoResultsFound';
import { AgentsTable } from './AgentsList/AgentsTable/AgentsTable';
import { VirtualCardsList } from './AgentsList/AgentsTiles/AgentsTiles';
import { ApplicationLogs } from './ApplicationLogs';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

interface NoAgentsFoundProps {
  children: React.ReactNode;
  description: string;
  header?: string;
}

const NoAgentsFound = ({
  children,
  description,
  header,
}: NoAgentsFoundProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <div className="flex grow flex-col items-center justify-center">
      {children}
      {header && (
        <span className="mt-5 text-lg font-semibold">{t(header)}</span>
      )}
      {description && (
        <span
          className="mt-4 text-sm font-normal"
          data-qa="no-data-description"
        >
          {t(description)}
        </span>
      )}
    </div>
  );
};

interface ResultsViewProps {
  entities: DialAIEntityModel[];
  suggestedResults: DialAIEntityModel[];
  selectedTab: MarketplaceTabs;
  areAllFiltersEmpty: boolean;
  selectedViewType: ViewTypes;
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onEdit: (entity: DialAIEntityModel) => void;
  onBookmarkClick: (entity: DialAIEntityModel) => void;
  onLogsClick: (entity: DialAIEntityModel) => void;
}

const ResultsView = memo(
  ({
    areAllFiltersEmpty,
    selectedViewType,
    entities,
    suggestedResults,
    ...props
  }: ResultsViewProps) => {
    if (entities.length || suggestedResults.length) {
      const AgentsListComponent =
        selectedViewType === ViewTypes.TABLE ? AgentsTable : VirtualCardsList;

      return (
        <AgentsListComponent
          entities={entities}
          suggestedResults={suggestedResults}
          separator="Suggested results from DIAL Marketplace"
          {...props}
        />
      );
    }

    if (areAllFiltersEmpty) {
      return (
        <NoAgentsFound
          header="No agents"
          description="You don't have any agents."
        >
          <IconMessage2 size={100} className="stroke-[0.2]" />
        </NoAgentsFound>
      );
    }

    return (
      <NoAgentsFound description="Sorry, we couldn't find any results for your search.">
        <NoResultsFound
          iconSize={100}
          className="gap-5 text-lg font-semibold"
        />
      </NoAgentsFound>
    );
  },
);
ResultsView.displayName = 'ResultsView';

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
      heading: translate('Confirm removing agent'),
      description: translate(
        'Are you sure you want to remove the {{modelName}}{{modelVersion}} from My workspace?',
        translationVariables,
      ),
      confirmLabel: translate('Remove'),
    },
  };

  return deleteConfirmationText[action];
};

export const TabRenderer = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const searchTerm = useAppSelector(
    MarketplaceSelectors.selectTrimmedSearchTerm,
  );
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const detailsModel = useAppSelector(MarketplaceSelectors.selectDetailsModel);
  const selectedViewType = useAppSelector(
    MarketplaceSelectors.selectSelectedViewType,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );
  const detailedApplicationTypeSchema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const isBannerVisible = useAppSelector(
    MarketplaceSelectors.selectIsBannerVisible,
  );

  const [suggestedResults, setSuggestedResults] = useState<DialAIEntityModel[]>(
    [],
  );
  const [deleteModel, setDeleteModel] = useState<{
    action: DeleteType;
    entity: DialAIEntityModel;
  }>();
  const [publishModel, setPublishModel] = useState<{
    entity: ShareEntity & { iconUrl?: string };
    action: PublishActions;
  }>();
  const [logsEntity, setLogsEntity] = useState<DialAIEntityModel>();

  const isSomeFilterNotEmpty =
    searchTerm.length ||
    selectedFilters[FilterTypes.ENTITY_TYPE].length ||
    selectedFilters[FilterTypes.TOPICS].length ||
    selectedFilters[FilterTypes.SOURCES].length;

  const areAllFiltersEmpty =
    !searchTerm.length &&
    !selectedFilters[FilterTypes.ENTITY_TYPE].length &&
    !selectedFilters[FilterTypes.TOPICS].length &&
    !selectedFilters[FilterTypes.SOURCES].length;

  const displayedEntities = useMemo(() => {
    const filteredEntities = allModels.filter(
      (entity) =>
        doesApplicationMatchSearchTerm(entity, searchTerm) &&
        doesApplicationMatchFilters(
          entity,
          selectedFilters,
          applicationTypeSchemas,
        ),
    );

    const isInstalledModel = (entity: DialAIEntityModel) =>
      installedModelIds.has(entity.reference);

    const entitiesForTab =
      selectedTab === MarketplaceTabs.MY_WORKSPACE
        ? filteredEntities.filter(isInstalledModel)
        : filteredEntities;

    const shouldSuggest =
      selectedTab === MarketplaceTabs.MY_WORKSPACE && isSomeFilterNotEmpty;

    if (selectedViewType === ViewTypes.TABLE) {
      if (shouldSuggest) {
        const suggestedListWithoutInstalled = filteredEntities.filter(
          (entity) => !isInstalledModel(entity),
        );

        setSuggestedResults(suggestedListWithoutInstalled);
      } else {
        setSuggestedResults([]);
      }

      return entitiesForTab;
    }

    const groupedEntities = groupModelsAndSaveOrder(
      entitiesForTab.concat(shouldSuggest ? filteredEntities : []),
    );

    let orderedEntities = groupedEntities.map(({ entities }) => entities[0]);

    if (shouldSuggest) {
      const suggestedListWithoutInstalled = orderedEntities.filter(
        (entity) => !isInstalledModel(entity),
      );
      orderedEntities = orderedEntities.filter(isInstalledModel);
      setSuggestedResults(suggestedListWithoutInstalled);
    } else {
      setSuggestedResults([]);
    }

    return orderedEntities;
  }, [
    allModels,
    selectedTab,
    selectedViewType,
    isSomeFilterNotEmpty,
    searchTerm,
    selectedFilters,
    installedModelIds,
    applicationTypeSchemas,
  ]);

  const handleEditApplication = useCallback(
    (entity: DialAIEntityModel) => {
      const applicationType = getApplicationType(entity);
      dispatch(
        ApplicationActions.enterEditMode({
          entity: entity,
          applicationType,
          detailedApplicationTypeSchemaId: detailedApplicationTypeSchema?.$id,
        }),
      );
    },
    [dispatch, detailedApplicationTypeSchema],
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

        dispatch(MarketplaceActions.setDetailsModel());
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

  const handleSetDetailsModel = useCallback(
    (model: DialAIEntityModel) => {
      dispatch(
        MarketplaceActions.setDetailsModel({
          reference: model.reference,
          isSuggested: suggestedResults
            .map((item) => item.reference)
            .includes(model.reference),
        }),
      );
    },
    [dispatch, suggestedResults],
  );

  const handleSetVersion = useCallback(
    (model: DialAIEntityModel) => {
      if (detailsModel) {
        dispatch(
          MarketplaceActions.setDetailsModel({
            ...detailsModel,
            reference: model.reference,
          }),
        );
      }
    },
    [detailsModel, dispatch],
  );

  const handleCloseDetailsDialog = useCallback(
    () => dispatch(MarketplaceActions.setDetailsModel()),
    [dispatch],
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

  const handleLogsClick = useCallback((entity: DialAIEntityModel) => {
    setLogsEntity(entity);
  }, []);

  const handleCloseApplicationLogs = useCallback(() => {
    setLogsEntity(undefined);
  }, []);

  const currentDetailsModel = detailsModel && modelsMap[detailsModel.reference];

  return (
    <>
      <header
        className="mb-5 px-3 md:mb-4 md:px-5 xl:mb-6 xl:px-16"
        data-qa="marketplace-header"
      >
        <div
          className={classNames(
            'w-full transition-all duration-1000',
            isBannerVisible
              ? 'max-h-[104px] translate-y-0'
              : 'max-h-0 translate-y-[-135px]',
          )}
        >
          <MarketplaceBanner />
        </div>
        <div
          className={classNames(
            'flex items-center justify-end gap-2 transition-all duration-1000 md:gap-4',
            isBannerVisible ? 'md:mt-4 xl:mt-6' : 'm-0',
          )}
        >
          <SearchHeader />
        </div>
      </header>

      <ResultsView
        entities={displayedEntities}
        suggestedResults={suggestedResults}
        selectedTab={selectedTab}
        areAllFiltersEmpty={areAllFiltersEmpty}
        selectedViewType={selectedViewType}
        onCardClick={handleSetDetailsModel}
        onPublish={handleSetPublishEntity}
        onDelete={handleDelete}
        onEdit={handleEditApplication}
        onBookmarkClick={handleBookmarkClick}
        onLogsClick={handleLogsClick}
      />

      {/* MODALS */}
      {!!deleteModel && (
        <ConfirmDialog
          isOpen
          {...getDeleteConfirmationText(deleteModel.action, deleteModel.entity)}
          onClose={handleDeleteClose}
          cancelLabel={t('Cancel')}
        />
      )}
      {currentDetailsModel && (
        <ApplicationDetails
          onPublish={handleSetPublishEntity}
          entity={currentDetailsModel}
          onChangeVersion={handleSetVersion}
          onClose={handleCloseDetailsDialog}
          onDelete={handleDelete}
          onEdit={handleEditApplication}
          onBookmarkClick={handleBookmarkClick}
          allEntities={allModels}
          isMyAppsTab={selectedTab === MarketplaceTabs.MY_WORKSPACE}
          isSuggested={detailsModel.isSuggested}
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
      {logsEntity && (
        <ApplicationLogs
          isOpen
          onClose={handleCloseApplicationLogs}
          entityId={logsEntity.id}
        />
      )}
    </>
  );
};
