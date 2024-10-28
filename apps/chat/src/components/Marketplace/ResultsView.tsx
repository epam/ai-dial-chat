import { IconMessage2 } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import { CardsList } from '@/src/components/Marketplace/CardsList';

import Magnifier from '../../../public/images/icons/search-alt.svg';
import { NoResultsFound } from '../Common/NoResultsFound';

import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  children: React.ReactNode;
  descr: string;
  header?: string;
}

const NoAgentsFound = ({ children, descr, header }: Props) => (
  <div className="flex grow flex-col items-center justify-center">
    {children}
    {header && <span className="mt-5 text-lg font-semibold">{header}</span>}
    {descr && <span className="mt-4 text-sm font-normal">{descr}</span>}
  </div>
);

interface ResultsViewProps {
  entities: DialAIEntityModel[];
  suggestedResults: DialAIEntityModel[];
  selectedTab: MarketplaceTabs;
  areAllFiltersEmpty: boolean;
  noResultsText: string;
  isNotDesktop: boolean;
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onEdit: (entity: DialAIEntityModel) => void;
  onBookmarkClick: (entity: DialAIEntityModel) => void;
}

const ResultsView = ({
  entities,
  suggestedResults,
  selectedTab,
  areAllFiltersEmpty,
  noResultsText,
  onCardClick,
  onPublish,
  onDelete,
  onEdit,
  isNotDesktop,
  onBookmarkClick,
}: ResultsViewProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const NoApplicationFound = () => (
    <NoAgentsFound
      header={t('No agents') ?? ''}
      descr={t("You don't have any agents.") ?? ''}
    >
      <IconMessage2 size={100} className="stroke-[0.2]" />
    </NoAgentsFound>
  );

  const NoResultsFoundMessage = () => (
    <NoAgentsFound descr={noResultsText}>
      <NoResultsFound iconSize={100} className="gap-5 text-lg" />
    </NoAgentsFound>
  );

  return entities.length ? (
    <CardsList
      entities={entities}
      onCardClick={onCardClick}
      onPublish={onPublish}
      onDelete={onDelete}
      onEdit={onEdit}
      isNotDesktop={isNotDesktop}
      onBookmarkClick={onBookmarkClick}
    />
  ) : (
    <>
      {selectedTab === MarketplaceTabs.MY_APPLICATIONS && areAllFiltersEmpty ? (
        <NoApplicationFound />
      ) : suggestedResults.length ? (
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
            onCardClick={onCardClick}
            onPublish={onPublish}
            onDelete={onDelete}
            onEdit={onEdit}
            isNotDesktop={isNotDesktop}
            onBookmarkClick={onBookmarkClick}
          />
        </>
      ) : (
        <NoResultsFoundMessage />
      )}
    </>
  );
};

export default ResultsView;
