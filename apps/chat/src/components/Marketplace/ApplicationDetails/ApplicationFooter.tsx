import {
  IconEdit,
  IconPlayerPlay,
  IconPlayerStop,
  IconTrashX,
  IconWorldShare,
} from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { isExecutableApp } from '@/src/utils/app/application';
import { getRootId, isApplicationId } from '@/src/utils/app/id';
import { isEntityPublic } from '@/src/utils/app/publications';

import { ApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { ModelVersionSelect } from '../../Chat/ModelVersionSelect';
import Tooltip from '../../Common/Tooltip';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
  allVersions: DialAIEntityModel[];
  isMyAppsTab: boolean;
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onUseEntity: () => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onEdit: (entity: DialAIEntityModel) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onRemove: (entity: DialAIEntityModel) => void;
}

export const ApplicationDetailsFooter = ({
  entity,
  allVersions,
  isMyAppsTab,
  onChangeVersion,
  onPublish,
  onUseEntity,
  onEdit,
  onDelete,
  onRemove,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const application = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const isMyApp = entity.id.startsWith(
    getRootId({ featureType: FeatureType.Application }),
  );
  const isPublicApp = isEntityPublic(entity);
  const isExecutable = application
    ? isExecutableApp(application) && isMyApp
    : false;

  const handleToggleApplicationStatus = () => {
    if (application) {
      dispatch(
        ApplicationActions.toggleApplicationStatus({ appId: application.id }),
      );
    }
  };

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          {/* <IconShare
            className="shrink-0 text-accent-primary md:hidden [&_path]:fill-current"
            size={24}
          /> */}
          {(isMyAppsTab || isMyApp) && (
            <Tooltip tooltip={isMyApp ? t('Delete') : t('Remove')}>
              <button
                onClick={() => (isMyApp ? onDelete(entity) : onRemove(entity))}
                className="group flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                data-qa="application-edit"
              >
                <IconTrashX
                  size={24}
                  className="shrink-0 group-hover:text-accent-primary"
                />
              </button>
            </Tooltip>
          )}

          {isApplicationId(entity.id) && (
            <Tooltip tooltip={isPublicApp ? t('Unpublish') : t('Publish')}>
              <button
                onClick={() =>
                  onPublish(
                    entity,
                    isPublicApp ? PublishActions.DELETE : PublishActions.ADD,
                  )
                }
                className="group flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                data-qa="application-publish"
              >
                {isPublicApp ? (
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
            <Tooltip tooltip={t('Edit')}>
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
            </Tooltip>
          )}

          {isExecutable && (
            <button
              onClick={handleToggleApplicationStatus}
              className="group flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
              data-qa="application-status-toggler"
            >
              {application?.function?.status === ApplicationStatus.STARTED ? (
                <IconPlayerStop
                  size={24}
                  className="shrink-0 group-hover:text-accent-primary"
                />
              ) : (
                <IconPlayerPlay
                  size={24}
                  className="shrink-0 group-hover:text-accent-primary"
                />
              )}
            </button>
          )}
        </div>
        <div className="flex w-full items-center justify-end gap-4">
          <ModelVersionSelect
            className="cursor-pointer truncate"
            entities={allVersions}
            currentEntity={entity}
            showVersionPrefix
            onSelect={(entity) => onChangeVersion(entity)}
          />
          <button
            onClick={onUseEntity}
            className="button button-primary flex shrink-0 items-center gap-3"
            data-qa="use-button"
          >
            <IconPlayerPlay size={18} />
            <span className="hidden md:block">
              {t('Use {{modelType}}', {
                modelType: entity.type,
              })}
            </span>
            <span className="block md:hidden">{t('Use')}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
