import { useTranslation } from 'next-i18next';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationCard } from '@/src/components/Marketplace/ApplicationCard';

import { PublishActions } from '@epam/ai-dial-shared';

interface CardsListProps {
  entities: DialAIEntityModel[];
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  isNotDesktop?: boolean;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  title?: string;
  className?: string;
}

export const CardsList = ({
  entities,
  onCardClick,
  onPublish,
  onDelete,
  onEdit,
  isNotDesktop,
  onBookmarkClick,
  title,
  className,
}: CardsListProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <section className={className}>
      {!!title && <h2 className="text-xl font-semibold">{t(title)}</h2>}

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5 2xl:grid-cols-4"
        data-qa="applications"
      >
        {entities.map((entity) => (
          <ApplicationCard
            key={entity.id}
            entity={entity}
            onClick={onCardClick}
            onPublish={onPublish}
            onDelete={onDelete}
            onEdit={onEdit}
            isNotDesktop={isNotDesktop}
            onBookmarkClick={onBookmarkClick}
          />
        ))}
      </div>
    </section>
  );
};
