import {
  IconEdit,
  IconFileDescription,
  IconPlayerPlay,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { useCallback } from 'react';

import classNames from 'classnames';

import { useApplicationMenuActions } from '@/src/hooks/useApplicationActions';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getApplicationNextStatus,
  getApplicationSimpleStatus,
  getPlayerCaption,
  isApplicationDeploymentInProgress,
  isApplicationPublic,
  isApplicationStatusUpdating,
  isExecutableApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import {
  ApplicationStatus,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { FeatureType, ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { AuthSelectors } from '@/src/store/auth/auth.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';

import {
  PlayerContextButtonClasses,
  StatusIcons,
} from '@/src/constants/marketplace';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import Tooltip from '@/src/components/Common/Tooltip';
import { AgentBookmark } from '@/src/components/Marketplace/AgentBookmark';
import { AgentContextMenu } from '@/src/components/Marketplace/AgentContextMenu';

import { ApplicationCopyLink } from './ApplicationCopyLink';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature } from '@epam/ai-dial-shared';

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
  onBookmarkClick: (entity: DialAIEntityModel) => void;
}

export const ApplicationDetailsFooter = ({
  entity,
  allVersions,
  onChangeVersion,
  onUseEntity,
  onBookmarkClick,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();
  const screenState = useScreenState();

  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );

  const isMyApp = isMyApplication(entity);
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const hasPublicId = isEntityIdPublic(entity);
  const isPublicApp = isApplicationPublic(entity);

  const isSmallScreen = screenState === ScreenState.SM;

  const canWrite = canWriteSharedWithMe(entity);

  const isExecutable =
    isExecutableApp(entity) && (isMyApp || canWrite || isAdmin);

  const {
    handleDelete,
    handleUnpublish,
    handlePublish,
    handleEdit,
    handleOpenApplicationLogs,
  } = useApplicationMenuActions(entity);

  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const isAppInDeployment = isApplicationDeploymentInProgress(entity);

  const PlayerIcon = StatusIcons[playerStatus];

  const handleUpdateFunctionStatus = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(
        ApplicationActions.startUpdatingFunctionStatus({
          id: entity.id,
          status: getApplicationNextStatus(entity),
        }),
      );
    },
    [dispatch, entity],
  );

  const handleOpenUnshare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(ShareActions.setUnshareEntity(entity));
    },
    [dispatch, entity],
  );

  const handleOpenSharing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(
        ShareActions.share({
          featureType: FeatureType.Application,
          entity: entity,
        }),
      );
    },
    [dispatch, entity],
  );

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const showContextMenu = entity.reference !== entity.id;

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isSmallScreen && showContextMenu ? (
            <button className="icon-button">
              <AgentContextMenu
                className="xl:invisible group-hover:xl:visible"
                entity={entity}
              />
            </button>
          ) : (
            <>
              {isPublicApp && isSmallScreen && (
                <ApplicationCopyLink
                  entity={entity}
                  size={24}
                  hasTooltip
                  className="icon-button !p-[5px]"
                />
              )}
              {isExecutable && isCodeAppsEnabled && (
                <Tooltip tooltip={t(getPlayerCaption(entity))}>
                  <button
                    disabled={playerStatus === SimpleApplicationStatus.UPDATING}
                    onClick={handleUpdateFunctionStatus}
                    className={classNames(
                      'icon-button',
                      PlayerContextButtonClasses[playerStatus],
                    )}
                    data-qa="application-status-toggler"
                  >
                    <PlayerIcon size={24} />
                  </button>
                </Tooltip>
              )}
              {isMyApp && isApplicationsSharingEnabled && isSmallScreen && (
                <Tooltip tooltip={t('Share')}>
                  <button
                    onClick={handleOpenSharing}
                    className="icon-button"
                    data-qa="application-share"
                  >
                    <IconUserShare size={24} />
                  </button>
                </Tooltip>
              )}
              {!!entity.sharedWithMe && isApplicationsSharingEnabled && (
                <Tooltip tooltip={t('Unshare application')}>
                  <button
                    onClick={handleOpenUnshare}
                    className="icon-button"
                    data-qa="application-unshare"
                  >
                    <IconUserUnshare height={24} width={24} />
                  </button>
                </Tooltip>
              )}
              {isMyApp && (
                <Tooltip tooltip={t(getDisabledTooltip(entity, 'Delete'))}>
                  <button
                    disabled={isModifyDisabled}
                    onClick={handleDelete}
                    className="icon-button"
                    data-qa="application-delete"
                  >
                    <IconTrashX size={24} />
                  </button>
                </Tooltip>
              )}
              {(isMyApp || hasPublicId) && (
                <Tooltip tooltip={hasPublicId ? t('Unpublish') : t('Publish')}>
                  <button
                    onClick={hasPublicId ? handleUnpublish : handlePublish}
                    className="icon-button"
                    data-qa="application-publish"
                  >
                    {hasPublicId ? (
                      <UnpublishIcon className="size-6 shrink-0" />
                    ) : (
                      <IconWorldShare size={24} />
                    )}
                  </button>
                </Tooltip>
              )}
              {(isMyApp || canWrite) && (
                <Tooltip tooltip={t('Edit')}>
                  <button
                    disabled={isAppInDeployment}
                    onClick={handleEdit}
                    className="icon-button"
                    data-qa="application-edit"
                  >
                    <IconEdit size={24} />
                  </button>
                </Tooltip>
              )}
              {isExecutable &&
                playerStatus === SimpleApplicationStatus.UNDEPLOY && (
                  <Tooltip tooltip={t('Application logs')}>
                    <button
                      onClick={handleOpenApplicationLogs}
                      className="icon-button"
                      data-qa="application-logs"
                    >
                      <IconFileDescription size={24} />
                    </button>
                  </Tooltip>
                )}
            </>
          )}
          <AgentBookmark
            entity={entity}
            size={24}
            className="icon-button group/bookmark"
            onBookmarkClick={onBookmarkClick}
          />
        </div>
        <div className="flex w-full min-w-0 items-center justify-end gap-4">
          <ModelVersionSelect
            className="truncate"
            entities={allVersions}
            currentEntity={entity}
            showVersionPrefix
            onSelect={onChangeVersion}
          />
          <Tooltip
            hideTooltip={
              !isExecutableApp(entity) ||
              playerStatus === SimpleApplicationStatus.UNDEPLOY
            }
            tooltip={
              hasPublicId && !isAdmin
                ? t(
                    'Ask your administrator to deploy this application to be able to use it',
                  )
                : t('Deploy the application to be able to use it')
            }
          >
            <button
              onClick={onUseEntity}
              className="button button-primary flex shrink-0 items-center gap-2 font-theme text-sm"
              data-qa="use-button"
              disabled={
                isExecutableApp(entity) &&
                playerStatus !== SimpleApplicationStatus.UNDEPLOY
              }
            >
              <IconPlayerPlay size={18} />
              <span className="hidden md:block">
                {t('Use {{modelType}}', {
                  modelType: entity.type,
                })}
              </span>
              <span className="block md:hidden">{t('Use')}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </section>
  );
};
