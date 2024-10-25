import {
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
  isExecutableApp,
} from '@/src/utils/app/application';
import { getRootId, isApplicationId } from '@/src/utils/app/id';
import { isEntityPublic } from '@/src/utils/app/publications';

import { ApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Loader from '@/src/components/Common/Loader';

import { ModelVersionSelect } from '../../Chat/ModelVersionSelect';
import Tooltip from '../../Common/Tooltip';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

const getFunctionTooltip = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.CREATED:
    case ApplicationStatus.STOPPED:
    case ApplicationStatus.FAILED:
      return 'Start application';
    case ApplicationStatus.STARTED:
      return 'Stop application';
    case ApplicationStatus.STARTING:
      return 'Starting';
    case ApplicationStatus.STOPPING:
      return 'Stopping';
    default:
      return '';
  }
};

const getDisabledTooltip = (entity: DialAIEntityModel, normal: string) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.STOPPING:
    case ApplicationStatus.STARTING:
      return `Application is ${entity.functionStatus.toLowerCase()}`;
    case ApplicationStatus.STARTED:
      return `Stop application to ${normal.toLowerCase()}`;
    default:
      return normal;
  }
};

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

  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );

  const isMyApp = entity.id.startsWith(
    getRootId({ featureType: FeatureType.Application }),
  );
  const isPublicApp = isEntityPublic(entity);
  const isExecutable = isExecutableApp(entity) && isMyApp;
  const isModifyDisabled =
    entity.functionStatus === ApplicationStatus.STARTING ||
    entity.functionStatus === ApplicationStatus.STOPPING ||
    entity.functionStatus === ApplicationStatus.STARTED;
  const playerStatus = getApplicationSimpleStatus(entity);

  const PlayerIcon = useMemo(() => {
    switch (playerStatus) {
      case 'start':
        return IconPlayerPlay;
      case 'stop':
        return IconPlaystationSquare;
      case 'loading':
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
                disabled={playerStatus === 'loading'}
                onClick={handleUpdateFunctionStatus}
                className={classNames('icon-button', {
                  ['button-error']: playerStatus === 'stop',
                  ['button-accent-secondary']: playerStatus === 'start',
                })}
                data-qa="application-status-toggler"
              >
                <PlayerIcon size={24} />
              </button>
            </Tooltip>
          )}

          {(isMyAppsTab || isMyApp) && (
            <Tooltip
              tooltip={t(
                isMyApp ? getDisabledTooltip(entity, 'Delete') : 'Remove',
              )}
            >
              <button
                disabled={isModifyDisabled && isMyApp}
                onClick={() => (isMyApp ? onDelete(entity) : onRemove(entity))}
                className="icon-button"
                data-qa="application-edit"
              >
                <IconTrashX size={24} />
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
