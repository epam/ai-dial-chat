import { IconBlocks, IconMessage2 } from '@tabler/icons-react';
import { memo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import {
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';

import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

import { MarketplaceEntitiesTable } from './MarketplaceEntitiesList/MarketplaceEntitiesTable/MarketplaceEntitiesTable';
import { MarketplaceEntitiesTiles } from './MarketplaceEntitiesList/MarketplaceEntitiesTiles/MarketplaceEntitiesTiles';

interface NoAgentsFoundProps {
  children: React.ReactNode;
  description: string;
  header?: string;
}

const NoMarketplaceEntitiesFound = ({
  children,
  description,
  header,
}: NoAgentsFoundProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <div
      className="flex grow flex-col items-center justify-center"
      data-qa="no-data-container"
    >
      {children}
      {header && (
        <span className="mt-5 text-lg font-semibold" data-qa="no-data-header">
          {t(header)}
        </span>
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

export interface ResultsViewProps<T> {
  entities: T[];
  suggestedResults: T[];
  selectedTab: MarketplaceTabs;
  areAllFiltersEmpty: boolean;
  selectedViewType: ViewTypes;
  onCardClick: (entity: T) => void;
  onBookmarkClick: (entity: T) => void;
}

export const ResultsView = memo(
  ({
    areAllFiltersEmpty,
    selectedViewType,
    entities,
    suggestedResults,
    ...props
  }: ResultsViewProps<MarketplaceEntity>) => {
    const selectedEntitiesTab = useAppSelector(
      MarketplaceSelectors.selectSelectedEntitiesTab,
    );
    const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

    if (entities.length || suggestedResults.length) {
      const MarketplaceEntitiesListComponent =
        selectedViewType === ViewTypes.TABLE
          ? MarketplaceEntitiesTable
          : MarketplaceEntitiesTiles;

      return (
        <MarketplaceEntitiesListComponent
          entities={entities}
          suggestedResults={suggestedResults}
          separator="Suggested results from DIAL Marketplace"
          {...props}
        />
      );
    }

    if (areAllFiltersEmpty) {
      const Icon = isAgentsTab ? IconMessage2 : IconBlocks;
      return (
        <NoMarketplaceEntitiesFound
          header={isAgentsTab ? 'No agents' : 'No toolsets'}
          description={`You don't have any ${isAgentsTab ? 'agents' : 'toolsets'}.`}
        >
          <Icon size={100} className="stroke-[0.2]" />
        </NoMarketplaceEntitiesFound>
      );
    }

    return (
      <NoMarketplaceEntitiesFound description="Sorry, we couldn't find any results for your search.">
        <NoResultsFound
          iconSize={100}
          className="gap-5 text-lg font-semibold"
        />
      </NoMarketplaceEntitiesFound>
    );
  },
);
ResultsView.displayName = 'ResultsView';
