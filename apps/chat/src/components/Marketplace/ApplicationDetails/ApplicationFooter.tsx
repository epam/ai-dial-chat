import { IconEdit, IconPlayerPlay, IconWorldShare } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { getRootId, isApplicationId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import { ModelVersionSelect } from '../../Chat/ModelVersionSelect';
import Tooltip from '../../Common/Tooltip';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';

interface Props {
  modelType: string;
  entity: DialAIEntityModel;
  entities: DialAIEntityModel[];
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onUseEntity: () => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onEdit: (entity: DialAIEntityModel) => void;
}

export const ApplicationDetailsFooter = ({
  modelType,
  entities,
  entity,
  onChangeVersion,
  onPublish,
  onUseEntity,
  onEdit,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);


  const isPublishedApplication = entity.id.startsWith(
    getRootId({
      featureType: FeatureType.Application,
      bucket: PUBLIC_URL_PREFIX,
    }),
  );
  const isMyApp = entity.id.startsWith(
    getRootId({ featureType: FeatureType.Application }),
  );

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          {/* <IconShare
            className="shrink-0 text-accent-primary md:hidden [&_path]:fill-current"
            size={24}
          /> */}
          {isApplicationId(entity.id) && (
            <Tooltip
              tooltip={isPublishedApplication ? t('Unpublish') : t('Publish')}
            >
              <button
                onClick={() =>
                  onPublish(
                    entity,
                    isPublishedApplication
                      ? PublishActions.DELETE
                      : PublishActions.ADD,
                  )
                }
                className="group flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                data-qa="application-publish"
              >
                {isPublishedApplication ? (
                  <UnpublishIcon className="size-6 shrink-0 cursor-pointer text-secondary hover:text-accent-primary group-hover:text-accent-primary" />
                ) : (
                  <IconWorldShare
                    size={24}
                    className="shrink-0 cursor-pointer text-secondary group-hover:text-accent-primary"
                  />
                )}
              </button>
            </Tooltip>
          )}
          {isMyApp && (
            <button
              onClick={() => onEdit(entity)}
              className="group flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
              data-qa="application-edit"
            >
              <IconEdit
                size={24}
                className="shrink-0 group-hover:text-accent-primary"
              />
            </button>
          )}
        </div>
        <div className="flex w-full items-center justify-end gap-4">
          <ModelVersionSelect
            className="cursor-pointer truncate"
            entities={entities}
            currentEntity={entity}
            onSelect={onChangeVersion}
          />
          <button
            onClick={onUseEntity}
            className="flex shrink-0 items-center gap-3 rounded bg-accent-primary px-3 py-2 text-sm font-semibold"
          >
            <IconPlayerPlay size={18} />
            <span className="hidden md:block">
              {t('Use {{modelType}}', {
                modelType,
              })}
            </span>
            <span className="block md:hidden">{t('Use')}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
