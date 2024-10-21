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
  onRemove?: (entity: DialAIEntityModel) => void;
  isMobile?: boolean;
  title?: string;
  className?: string;
}

export const CardsList = ({
  entities,
  onCardClick,
  onPublish,
  onDelete,
  onEdit,
  onRemove,
  isMobile,
  title,
  className,
}: CardsListProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <section className={className}>
      {!!title && <h2 className="text-xl font-semibold">{t(title)}</h2>}

      <div
        className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3 lg:gap-6 2xl:grid-cols-4"
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
            onRemove={onRemove}
            isMobile={isMobile}
          />
        ))}
      </div>
    </section>
  );
};
