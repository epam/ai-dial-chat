import { useTranslation } from 'next-i18next';

import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ApplicationCard } from '@/src/components/Marketplace/ApplicationCard';

interface CardsListProps {
  entities: DialAIEntityModel[];
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  isMobile?: boolean;
  title?: string;
  className?: string;
}

export const CardsList = ({
  entities,
  onCardClick,
  onPublish,
  onDelete,
  isMobile,
  title,
  className,
}: CardsListProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <section className={className}>
      {!!title && <h2 className="text-xl font-semibold">{t(title)}</h2>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 2xl:grid-cols-4">
        {entities.map((entity) => (
          <ApplicationCard
            key={entity.id}
            entity={entity}
            onClick={onCardClick}
            onPublish={onPublish}
            onDelete={onDelete}
            isMobile={isMobile}
          />
        ))}
      </div>
    </section>
  );
};
