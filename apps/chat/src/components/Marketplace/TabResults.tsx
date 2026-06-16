import { IconBlocks, IconMessage2 } from '@tabler/icons-react';
import React, { memo, useCallback } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import {
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  ViewTypes,
} from '@/src/constants/marketplace';

import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

import { MarketplaceEntitiesTable } from './MarketplaceEntitiesList/MarketplaceEntitiesTable/MarketplaceEntitiesTable';
import { MarketplaceEntitiesTiles } from './MarketplaceEntitiesList/MarketplaceEntitiesTiles/MarketplaceEntitiesTiles';
import { translateMarketplaceTabEmptyState } from './translateMarketplaceTabEmptyState';

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
  const router = useRouter();

  const translateLabel = useCallback(
    (key: string) => translateMarketplaceTabEmptyState(key, router.locale, t),
    [router.locale, t],
  );

  return (
    <div
      className="flex grow flex-col items-center justify-center"
      data-qa="no-data-container"
    >
      {children}
      {header && (
        <span className="mt-5 text-lg font-semibold" data-qa="no-data-header">
          {translateLabel(header)}
        </span>
      )}
      {description && (
        <span
          className="mt-4 text-sm font-normal"
          data-qa="no-data-description"
        >
          {translateLabel(description)}
        </span>
      )}
    </div>
  );
};

export interface ResultsViewProps<T> {
  entities: T[];
  suggestedResults: T[];
  featuredEntities: T[];
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
    featuredEntities,
    ...props
  }: ResultsViewProps<MarketplaceEntity>) => {
    const selectedEntitiesTab = useAppSelector(
      MarketplaceSelectors.selectSelectedEntitiesTab,
    );

    if (entities.length || suggestedResults.length) {
      const MarketplaceEntitiesListComponent =
        selectedViewType === ViewTypes.TABLE
          ? MarketplaceEntitiesTable
          : MarketplaceEntitiesTiles;

      return (
        <MarketplaceEntitiesListComponent
          entities={entities}
          suggestedResults={suggestedResults}
          featuredEntities={featuredEntities}
          {...props}
        />
      );
    }

    if (areAllFiltersEmpty) {
      const isAgentsTab =
        selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;
      const Icon = isAgentsTab ? IconMessage2 : IconBlocks;
      return (
        <NoMarketplaceEntitiesFound
          header={
            isAgentsTab
              ? MarketplaceI18nKeys.NoAgents
              : MarketplaceI18nKeys.NoToolsets
          }
          description={
            isAgentsTab
              ? MarketplaceI18nKeys.YouDontHaveAnyAgents
              : MarketplaceI18nKeys.YouDontHaveAnyToolsets
          }
        >
          <Icon size={100} className="stroke-[0.2]" />
        </NoMarketplaceEntitiesFound>
      );
    }

    return (
      <NoMarketplaceEntitiesFound
        description={MarketplaceI18nKeys.NoSearchResults}
      >
        <NoResultsFound
          iconSize={100}
          className="gap-5 text-lg font-semibold"
        />
      </NoMarketplaceEntitiesFound>
    );
  },
);
ResultsView.displayName = 'ResultsView';
