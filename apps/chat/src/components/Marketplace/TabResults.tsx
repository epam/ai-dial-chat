import { IconMessage2 } from '@tabler/icons-react';
import { memo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { MarketplaceTabs, ViewTypes } from '@/src/constants/marketplace';

import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

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
