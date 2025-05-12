import { IconMessage2 } from '@tabler/icons-react';
import { memo, useCallback, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { groupModelsAndSaveOrder } from '@/src/utils/app/models';
import {
  doesApplicationMatchFilters,
  doesApplicationMatchSearchTerm,
} from '@/src/utils/marketplace';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceActions } from '@/src/store/marketplace/marketplace.reducers';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';
import { ModelsActions } from '@/src/store/models/models.reducers';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import {
  DeleteType,
  FilterTypes,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';

import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import { ApplicationDetails } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { MarketplaceBanner } from '@/src/components/Marketplace/MarketplaceBanner';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

import { AgentDialogs } from '../Common/AgentDialogs';
import { AgentsTable } from './AgentsList/AgentsTable/AgentsTable';
import { AgentsTiles } from './AgentsList/AgentsTiles/AgentsTiles';

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
  onBookmarkClick: (entity: DialAIEntityModel) => void;
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
        selectedViewType === ViewTypes.TABLE ? AgentsTable : AgentsTiles;

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

export const TabRenderer = () => {
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
  const isBannerVisible = useAppSelector(
    MarketplaceSelectors.selectIsBannerVisible,
  );

  const [suggestedResults, setSuggestedResults] = useState<DialAIEntityModel[]>(
    [],
  );

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
        dispatch(
          MarketplaceActions.setDeleteModel({
            entity,
            action: DeleteType.REMOVE,
          }),
        );
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
        onBookmarkClick={handleBookmarkClick}
      />

      {/* MODALS */}

      {currentDetailsModel && (
        <ApplicationDetails
          entity={currentDetailsModel}
          onChangeVersion={handleSetVersion}
          onClose={handleCloseDetailsDialog}
          onBookmarkClick={handleBookmarkClick}
          allEntities={allModels}
          isMyAppsTab={selectedTab === MarketplaceTabs.MY_WORKSPACE}
          isSuggested={detailsModel.isSuggested}
        />
      )}

      <AgentDialogs />
    </>
  );
};
