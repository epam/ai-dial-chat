import {
  IconBookmark,
  IconBookmarkFilled,
  IconFileDescription,
  IconPencilMinus,
  IconPlayerPlay,
  IconPlaystationSquare,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import {
  getApplicationNextStatus,
  getApplicationSimpleStatus,
  getModelShortDescription,
  isApplicationStatusUpdating,
  isExecutableApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isMediumScreen } from '@/src/utils/app/mobile';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import {
  ApplicationStatus,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { FeatureType, ScreenState } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { AuthSelectors } from '@/src/store/auth/auth.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import ContextMenu from '@/src/components/Common/ContextMenu';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ApplicationTopic } from '@/src/components/Marketplace/ApplicationTopic';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

import ShareIcon from '../Common/ShareIcon';
import Tooltip from '../Common/Tooltip';
import { ApplicationLogs } from './ApplicationLogs';

import LoaderIcon from '@/public/images/icons/loader.svg';
import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

const DESKTOP_ICON_SIZE = 80;
const SMALL_ICON_SIZE = 48;

// TODO uncomment in #2943
// const MOBILE_SHARE_ICON_SIZE = 16;
const TABLET_SHARE_ICON_SIZE = 20;
const DESKTOP_SHARE_ICON_SIZE = 30;

interface CardFooterProps {
  entity: DialAIEntityModel;
}

const CardFooter = ({ entity }: CardFooterProps) => {
  return (
    <>
      <EntityMarkdownDescription className="mt-3 line-clamp-2 text-ellipsis text-sm leading-[18px] text-secondary xl:hidden">
        {getModelShortDescription(entity)}
      </EntityMarkdownDescription>
      <div className="flex flex-col gap-2 pt-3 md:pt-4">
        {/* <span className="text-sm leading-[21px] text-secondary">
        Capabilities: Conversation
      </span> */}

        <div className="flex gap-2 overflow-hidden">
          {entity.topics?.map((topic) => (
            <ApplicationTopic key={topic} topic={topic} />
          ))}
        </div>
      </div>
    </>
  );
};

const getPlayerCaption = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.DEPLOYED:
      return 'Undeploy';
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return 'Deploy';
    case ApplicationStatus.UNDEPLOYING:
      return 'Undeploying';
    case ApplicationStatus.DEPLOYING:
    default:
      return 'Deploying';
  }
};

interface ApplicationCardProps {
  entity: DialAIEntityModel;
  isNotDesktop?: boolean;
  onClick: (entity: DialAIEntityModel) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
}

export const ApplicationCard = ({
  entity,
  isNotDesktop,
  onClick,
  onDelete,
  onEdit,
  onBookmarkClick,
  onPublish,
}: ApplicationCardProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();
  const screenState = useScreenState();

  const [isOpenLogs, setIsOpenLogs] = useState<boolean>();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const isMyApp = isMyApplication(entity);

  const canWrite = canWriteSharedWithMe(entity);

  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const isExecutable =
    isExecutableApp(entity) && (isMyApp || isAdmin || canWrite);

  const shareIconSize =
    screenState === ScreenState.DESKTOP
      ? DESKTOP_SHARE_ICON_SIZE
      : TABLET_SHARE_ICON_SIZE;

  const PlayerIcon = useMemo(() => {
    switch (playerStatus) {
      case SimpleApplicationStatus.DEPLOY:
        return IconPlayerPlay;
      case SimpleApplicationStatus.UNDEPLOY:
        return IconPlaystationSquare;
      case SimpleApplicationStatus.UPDATING:
      default:
        return LoaderIcon;
    }
  }, [playerStatus]);

  const handleUpdateFunctionStatus = useCallback(() => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: entity.id,
        status: getApplicationNextStatus(entity),
      }),
    );
  }, [dispatch, entity]);

  const handleCloseApplicationLogs = useCallback(
    () => setIsOpenLogs(false),
    [setIsOpenLogs],
  );

  const handleOpenSharing = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Application,
        resourceId: entity.id,
      }),
    );
  }, [dispatch, entity.id]);

  const handleOpenUnshare = useCallback(
    () => dispatch(ShareActions.setUnshareEntity(entity)),
    [dispatch, entity],
  );

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        display:
          (isAdmin || isMyApp) && !!entity.functionStatus && isCodeAppsEnabled,
        Icon: PlayerIcon,
        iconClassName: classNames({
          ['text-error']: playerStatus === SimpleApplicationStatus.UNDEPLOY,
          ['text-accent-secondary']:
            playerStatus === SimpleApplicationStatus.DEPLOY,
          ['animate-spin-steps']:
            playerStatus === SimpleApplicationStatus.UPDATING,
        }),
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleUpdateFunctionStatus();
        },
      },
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: (isMyApp || !!canWrite) && !!onEdit,
        Icon: IconPencilMinus,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onEdit?.(entity);
        },
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display: isMyApp && isApplicationsSharingEnabled,
        Icon: IconUserShare,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          handleOpenSharing();
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
        name: t('Publish'),
        dataQa: 'publish',
        display: isMyApp && !!onPublish,
        Icon: IconWorldShare,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onPublish?.(entity, PublishActions.ADD);
        },
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isEntityIdPublic(entity) && !!onPublish,
        Icon: UnpublishIcon,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onPublish?.(entity, PublishActions.DELETE);
        },
      },
      {
        name: t('Logs'),
        dataQa: 'app-logs',
        display:
          !!isExecutable && playerStatus === SimpleApplicationStatus.UNDEPLOY,
        Icon: IconFileDescription,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpenLogs(true);
        },
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyApp && !!onDelete,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        iconClassName: 'stroke-error',
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete?.(entity);
        },
      },
    ],
    [
      t,
      entity,
      playerStatus,
      isAdmin,
      isMyApp,
      isCodeAppsEnabled,
      PlayerIcon,
      canWrite,
      onEdit,
      isApplicationsSharingEnabled,
      onPublish,
      isExecutable,
      onDelete,
      isModifyDisabled,
      handleUpdateFunctionStatus,
      handleOpenSharing,
      handleOpenUnshare,
    ],
  );

  const iconSize =
    (isNotDesktop ?? isMediumScreen()) ? SMALL_ICON_SIZE : DESKTOP_ICON_SIZE;
  const Bookmark = installedModelIds.has(entity.reference)
    ? IconBookmarkFilled
    : IconBookmark;

  return (
    <>
      <div
        onClick={() => onClick(entity)}
        className="group relative h-[162px] cursor-pointer rounded-md bg-layer-2 p-4 shadow-card hover:bg-layer-3 xl:h-[164px] xl:p-5"
        data-qa="agent"
      >
        <div>
          <div className="absolute right-4 top-4 flex gap-1 xl:right-5 xl:top-5">
            <ContextMenu
              menuItems={menuItems}
              featureType={FeatureType.Application}
              triggerIconHighlight
              triggerIconSize={18}
              className="m-0 xl:invisible group-hover:xl:visible"
            />
            {!isMyApp && (
              <Tooltip
                tooltip={
                  installedModelIds.has(entity.reference)
                    ? t('Remove from My workspace')
                    : t('Add to My workspace')
                }
                isTriggerClickable
              >
                <Bookmark
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookmarkClick?.(entity);
                  }}
                  className="rounded text-secondary hover:text-accent-primary"
                  size={18}
                />
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="flex shrink-0 items-center justify-center xl:my-[3px]">
              <ShareIcon
                {...entity}
                isHighlighted={false}
                size={shareIconSize}
                featureType={FeatureType.Application}
                iconClassName="bg-layer-2 !stroke-[0.6] group-hover:bg-transparent !rounded-[4px]"
                iconWrapperClassName="!rounded-[4px]"
              >
                <ModelIcon
                  entityId={entity.id}
                  entity={entity}
                  size={iconSize}
                />
              </ShareIcon>
            </div>
            <div className="flex grow flex-col justify-center gap-2 overflow-hidden">
              {entity.version && (
                <div
                  className={classNames(
                    'text-xs leading-[14px] text-secondary',
                    !isMyApp && 'mr-6',
                  )}
                >
                  {t('Version: ')}
                  {entity.version}
                </div>
              )}
              <div className="flex whitespace-nowrap">
                <div
                  className={classNames(
                    'shrink truncate text-base font-semibold leading-[20px] text-primary',
                    !isMyApp && !entity.version && 'mr-6',
                  )}
                  data-qa="agent-name"
                >
                  {entity.name}
                </div>
                <FunctionStatusIndicator entity={entity} />
              </div>
              <EntityMarkdownDescription className="hidden text-ellipsis text-sm leading-[18px] text-secondary xl:!line-clamp-2">
                {getModelShortDescription(entity)}
              </EntityMarkdownDescription>
            </div>
          </div>
        </div>
        <CardFooter entity={entity} />
      </div>
      {isOpenLogs && (
        <ApplicationLogs
          isOpen={isOpenLogs}
          onClose={handleCloseApplicationLogs}
          entityId={entity.id}
        />
      )}
    </>
  );
};
