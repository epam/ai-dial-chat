import {
  IconBookmark,
  IconBookmarkFilled,
  IconEdit,
  IconPlayerPlay,
  IconPlaystationSquare,
  IconTrashX,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getApplicationNextStatus,
  getApplicationSimpleStatus,
  isApplicationStatusUpdating,
  isExecutableApp,
} from '@/src/utils/app/application';
import { getRootId, isApplicationId } from '@/src/utils/app/id';
import { isEntityPublic } from '@/src/utils/app/publications';

import {
  ApplicationStatus,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { AuthSelectors } from '@/src/store/auth/auth.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Loader from '@/src/components/Common/Loader';

import { ModelVersionSelect } from '../../Chat/ModelVersionSelect';
import Tooltip from '../../Common/Tooltip';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

const getFunctionTooltip = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return 'Deploy';
    case ApplicationStatus.DEPLOYED:
      return 'Undeploy';
    case ApplicationStatus.DEPLOYING:
      return 'Deploying';
    case ApplicationStatus.UNDEPLOYING:
      return 'Undeploying';
    default:
      return '';
  }
};

const getDisabledTooltip = (entity: DialAIEntityModel, normal: string) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYING:
    case ApplicationStatus.DEPLOYING:
      return `Application is ${entity.functionStatus.toLowerCase()}`;
    case ApplicationStatus.DEPLOYED:
      return `Undeploy application to ${normal.toLowerCase()}`;
    default:
      return normal;
  }
};

interface Props {
  entity: DialAIEntityModel;
  allVersions: DialAIEntityModel[];
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onUseEntity: () => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onEdit: (entity: DialAIEntityModel) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onBookmarkClick: (entity: DialAIEntityModel) => void;
}

export const ApplicationDetailsFooter = ({
  entity,
  allVersions,
  onChangeVersion,
  onPublish,
  onUseEntity,
  onEdit,
  onDelete,
  onBookmarkClick,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const isMyApp = entity.id.startsWith(
    getRootId({ featureType: FeatureType.Application }),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const isPublicApp = isEntityPublic(entity);
  const Bookmark = installedModelIds.has(entity.reference)
    ? IconBookmarkFilled
    : IconBookmark;
  const isExecutable = isExecutableApp(entity) && (isMyApp || isAdmin);
  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);

  const PlayerIcon = useMemo(() => {
    switch (playerStatus) {
      case SimpleApplicationStatus.DEPLOY:
        return IconPlayerPlay;
      case SimpleApplicationStatus.UNDEPLOY:
        return IconPlaystationSquare;
      case SimpleApplicationStatus.UPDATING:
      default:
        return Loader;
    }
  }, [playerStatus]);

  const handleUpdateFunctionStatus = () => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: entity.id,
        status: getApplicationNextStatus(entity),
      }),
    );
  };

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          {isExecutable && isCodeAppsEnabled && (
            <Tooltip tooltip={t(getFunctionTooltip(entity))}>
              <button
                disabled={playerStatus === SimpleApplicationStatus.UPDATING}
                onClick={handleUpdateFunctionStatus}
                className={classNames('icon-button', {
                  ['button-error']:
                    playerStatus === SimpleApplicationStatus.UNDEPLOY,
                  ['button-accent-secondary']:
                    playerStatus === SimpleApplicationStatus.DEPLOY,
                })}
                data-qa="application-status-toggler"
              >
                <PlayerIcon size={24} />
              </button>
            </Tooltip>
          )}

          {isMyApp ? (
            <Tooltip tooltip={t(getDisabledTooltip(entity, 'Delete'))}>
              <button
                disabled={isModifyDisabled && isMyApp}
                onClick={() => onDelete(entity)}
                className="icon-button"
                data-qa="application-edit"
              >
                <IconTrashX size={24} />
              </button>
            </Tooltip>
          ) : (
            <Tooltip
              tooltip={
                installedModelIds.has(entity.reference)
                  ? t('Remove from My workspace')
                  : t('Add to My workspace')
              }
              isTriggerClickable
            >
              <button
                onClick={() => onBookmarkClick(entity)}
                className="icon-button"
                data-qa="application-bookmark"
              >
                <Bookmark size={24} />
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
                className="icon-button"
                data-qa="application-publish"
              >
                {isPublicApp ? (
                  <UnpublishIcon className="size-6 shrink-0" />
                ) : (
                  <IconWorldShare size={24} />
                )}
              </button>
            </Tooltip>
          )}
          {isMyApp && (
            <Tooltip tooltip={t(getDisabledTooltip(entity, 'Edit'))}>
              <button
                disabled={isModifyDisabled}
                onClick={() => onEdit(entity)}
                className="icon-button"
                data-qa="application-edit"
              >
                <IconEdit size={24} />
              </button>
            </Tooltip>
          )}
        </div>
        <div className="flex w-full items-center justify-end gap-4">
          <ModelVersionSelect
            className="cursor-pointer truncate"
            entities={allVersions}
            currentEntity={entity}
            showVersionPrefix
            onSelect={onChangeVersion}
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
