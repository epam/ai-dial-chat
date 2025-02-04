import {
  IconBookmark,
  IconBookmarkFilled,
  IconEdit,
  IconFileDescription,
  IconLink,
  IconPlayerPlay,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import classNames from 'classnames';

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
import { FeatureType, PageType, ScreenState } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { AuthSelectors } from '@/src/store/auth/auth.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import {
  MarketplaceQueryParams,
  PlayerContextButtonClasses,
  PlayerContextIconClasses,
  PlayerContextIcons,
  StatusIcons,
} from '@/src/constants/marketplace';

import { ModelVersionSelect } from '../../Chat/ModelVersionSelect';
import ContextMenu from '../../Common/ContextMenu';
import Tooltip from '../../Common/Tooltip';
import { ApplicationLogs } from '../ApplicationLogs';
import { ApplicationCopyLink } from './ApplicationCopyLink';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

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
  const screenState = useScreenState();

  const [isOpenLogs, setIsOpenLogs] = useState<boolean>();

  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const isMyApp = isMyApplication(entity);
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const hasPublicId = isEntityIdPublic(entity);
  const isPublicApp = isApplicationPublic(entity);

  const isSmallScreen = screenState === ScreenState.MOBILE;

  const Bookmark = installedModelIds.has(entity.reference)
    ? IconBookmarkFilled
    : IconBookmark;

  const canWrite = canWriteSharedWithMe(entity);

  const isExecutable = isExecutableApp(entity) && (isMyApp || isAdmin); //TODO add  ```|| canWrite``` when core issues #655 and #672 will be ready

  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const isAppInDeployment = isApplicationDeploymentInProgress(entity);

  const handleLogClick = useCallback(
    (entityId: string) => {
      dispatch(ApplicationActions.getLogs(entityId));
      setIsOpenLogs(true);
    },
    [dispatch],
  );

  const handleCloseApplicationLogs = useCallback(
    () => setIsOpenLogs(false),
    [setIsOpenLogs],
  );

  const PlayerIcon = StatusIcons[playerStatus];
  const PlayerContextIcon = PlayerContextIcons[playerStatus];

  const handleUpdateFunctionStatus = useCallback(() => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: entity.id,
        status: getApplicationNextStatus(entity),
      }),
    );
  }, [dispatch, entity]);

  const handleOpenUnshare = useCallback(
    () => dispatch(ShareActions.setUnshareEntity(entity)),
    [dispatch, entity],
  );

  const handleOpenSharing = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Application,
        resourceId: entity.id,
      }),
    );
  }, [dispatch, entity.id]);

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const link = useMemo(
    () =>
      `${window.location.origin}/${PageType.Marketplace}?${MarketplaceQueryParams.model}=${entity.reference}`,
    [entity.reference],
  );

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(link);
    dispatch(UIActions.showSuccessToast(t('Link copied!')));
  }, [dispatch, link, t]);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Copy link'),
        dataQa: 'application-copy-link',
        display: isPublicApp && isSmallScreen,
        Icon: IconLink,
        onClick: (e: React.MouseEvent) => {
          handleCopy();
          e.preventDefault();
          e.stopPropagation();
        },
      },
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        // TODO remove '&& !entity.sharedWithMe' when core issue will be ready #655
        display: isExecutable && isCodeAppsEnabled && !entity.sharedWithMe,
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        Icon: PlayerContextIcon,
        iconClassName: PlayerContextIconClasses[playerStatus],
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleUpdateFunctionStatus();
        },
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display: isMyApp && isApplicationsSharingEnabled && isSmallScreen,
        Icon: IconUserShare,
        onClick: (e: React.MouseEvent) => {
          handleOpenSharing();
          e.stopPropagation();
        },
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display: !!entity.sharedWithMe && isApplicationsSharingEnabled,
        Icon: IconUserUnshare,
        onClick: (e: React.MouseEvent) => {
          handleOpenUnshare();
          e.stopPropagation();
        },
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyApp,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete?.(entity);
        },
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isMyApp,
        Icon: IconWorldShare,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onPublish?.(entity, PublishActions.ADD);
        },
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: hasPublicId,
        Icon: UnpublishIcon,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onPublish?.(entity, PublishActions.DELETE);
        },
      },
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: (isMyApp || !!canWrite) && !!onEdit,
        disabled: isAppInDeployment,
        Icon: IconEdit,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onEdit?.(entity);
        },
      },
      {
        name: t('Application logs'),
        dataQa: 'app-logs',
        display:
          isExecutable && playerStatus === SimpleApplicationStatus.UNDEPLOY,
        Icon: IconFileDescription,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          handleLogClick(entity.id);
        },
      },
    ],
    [
      t,
      isPublicApp,
      isSmallScreen,
      entity,
      isExecutable,
      isCodeAppsEnabled,
      playerStatus,
      PlayerContextIcon,
      isMyApp,
      isApplicationsSharingEnabled,
      isModifyDisabled,
      hasPublicId,
      canWrite,
      onEdit,
      isAppInDeployment,
      handleCopy,
      handleUpdateFunctionStatus,
      handleOpenSharing,
      handleOpenUnshare,
      onDelete,
      onPublish,
      handleLogClick,
    ],
  );

  const hasBookmark = !isMyApp && !entity.sharedWithMe;
  const countDisplayTrue = menuItems.filter((item) => item.display).length;
  const menuItemsCount = hasBookmark ? countDisplayTrue + 1 : countDisplayTrue;

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isSmallScreen && menuItemsCount > 2 ? (
            <button className="icon-button">
              <ContextMenu
                menuItems={menuItems}
                featureType={FeatureType.Application}
                triggerIconHighlight
                className="m-0 xl:invisible group-hover:xl:visible"
              />
            </button>
          ) : (
            <>
              {isPublicApp && isSmallScreen && (
                <ApplicationCopyLink
                  reference={entity.reference}
                  size={24}
                  hasTooltip
                  className="icon-button !p-[5px]"
                />
              )}
              {/*TODO remove '&& !entity.sharedWithMe' when core issue will be ready #655*/}
              {isExecutable && isCodeAppsEnabled && !entity.sharedWithMe && (
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
                    onClick={() => onDelete(entity)}
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
                    onClick={() =>
                      onPublish(
                        entity,
                        hasPublicId
                          ? PublishActions.DELETE
                          : PublishActions.ADD,
                      )
                    }
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
                    onClick={() => onEdit(entity)}
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
                      onClick={() => handleLogClick(entity.id)}
                      className="icon-button"
                      data-qa="application-logs"
                    >
                      <IconFileDescription size={24} />
                    </button>
                  </Tooltip>
                )}
            </>
          )}
          {hasBookmark && (
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
        </div>
        <div className="flex w-full min-w-0 items-center justify-end gap-4">
          <ModelVersionSelect
            className="cursor-pointer truncate"
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
              className="button button-primary flex shrink-0 items-center gap-2"
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
      {isOpenLogs && (
        <ApplicationLogs
          isOpen={isOpenLogs}
          onClose={handleCloseApplicationLogs}
          entityId={entity.id}
        />
      )}
    </section>
  );
};
