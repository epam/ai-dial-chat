import { useTranslation } from 'next-i18next';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationCard } from '@/src/components/Marketplace/ApplicationCard';

import { PublishActions } from '@epam/ai-dial-shared';

interface CardsListProps {
  entities: DialAIEntityModel[];
  isNotDesktop?: boolean;
  title?: string;
  className?: string;
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onSelectVersion?: (entity: DialAIEntityModel) => void;
}

export const CardsList = ({
  entities,
  isNotDesktop,
  title,
  className,
  onCardClick,
  onPublish,
  onDelete,
  onEdit,
  onBookmarkClick,
}: CardsListProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <section className={className}>
      {!!title && <h2 className="text-xl font-semibold">{t(title)}</h2>}

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3 xl:gap-5 3xl:grid-cols-4 4xl:grid-cols-5 5xl:grid-cols-6"
        data-qa="agents"
      >
        {entities.map((entity) => (
          <ApplicationCard
            key={entity.id}
            entity={entity}
            isNotDesktop={isNotDesktop}
            onPublish={onPublish}
            onDelete={onDelete}
            onClick={onCardClick}
            onEdit={onEdit}
            onBookmarkClick={onBookmarkClick}
          />
        ))}
      </div>
    </section>
  );
};
