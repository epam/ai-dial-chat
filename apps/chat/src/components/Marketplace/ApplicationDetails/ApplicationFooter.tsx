import { IconPlayerPlay, IconShare, IconWorldShare } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isApplicationId } from '@/src/utils/app/id';
import { isItemPublic } from '@/src/utils/app/publications';
import { ApiUtils } from '@/src/utils/server/api';

import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ModelVersionSelect } from '../../Chat/ModelVersionSelect';
import { PublishModal } from '../../Chat/Publish/PublishWizard';
import Tooltip from '../../Common/Tooltip';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';

interface Props {
  modelType: string;
  entity: DialAIEntityModel;
  entities: DialAIEntityModel[];
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onUseEntity: () => void;
}

const ApplicationPublishActions = ({ entity }: Pick<Props, 'entity'>) => {
  const { t } = useTranslation(Translation.Chat);

  const [publishAction, setPublishAction] = useState<PublishActions>();

  const handleClosePublishModal = useCallback(() => {
    setPublishAction(undefined);
  }, []);

  const publishEntity = {
    name: entity.name,
    id: ApiUtils.decodeApiUrl(entity.id),
    folderId: getFolderIdFromEntityId(entity.id),
  };

  return (
    <>
      <Tooltip
        tooltip={isItemPublic(entity.id) ? t('Unpublish') : t('Publish')}
      >
        <button
          onClick={() =>
            setPublishAction(
              isItemPublic(entity.id)
                ? PublishActions.DELETE
                : PublishActions.ADD,
            )
          }
          className="group flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
          data-qa="application-share"
        >
          {isItemPublic(entity.id) ? (
            <UnpublishIcon className="size-6 shrink-0 cursor-pointer text-secondary hover:text-accent-primary group-hover:text-accent-primary" />
          ) : (
            <IconWorldShare
              size={24}
              className="shrink-0 cursor-pointer text-secondary group-hover:text-accent-primary"
            />
          )}
        </button>
      </Tooltip>
      {publishAction && (
        <PublishModal
          entity={publishEntity}
          type={SharingType.Application}
          isOpen
          onClose={handleClosePublishModal}
          publishAction={publishAction}
        />
      )}
    </>
  );
};

export const ApplicationDetailsFooter = ({
  modelType,
  entities,
  entity,
  onChangeVersion,
  onUseEntity,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <section className="flex p-4 md:px-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <IconShare
            className="shrink-0 text-accent-primary md:hidden [&_path]:fill-current"
            size={24}
          />
          {isApplicationId(entity.id) && (
            <ApplicationPublishActions entity={entity} />
          )}
        </div>
        <div className="flex w-full items-center justify-end gap-4">
          <ModelVersionSelect
            className="cursor-pointer"
            entities={entities}
            currentEntity={entity}
            onSelect={onChangeVersion}
          />
          <button
            onClick={onUseEntity}
            className="flex items-center gap-3 rounded bg-accent-primary px-3 py-2 text-sm font-semibold"
          >
            <IconPlayerPlay size={18} />
            <span>
              {t('Use {{modelType}}', {
                modelType,
              })}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
