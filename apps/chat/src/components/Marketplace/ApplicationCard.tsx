import {
  IconFileDescription,
  IconLink,
  IconPencilMinus,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import React, { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import {
  useMenuItemHandler,
  useMenuItemHandlerWithTwoArgs,
} from '@/src/hooks/useHandler';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getApplicationNextStatus,
  getApplicationSimpleStatus,
  getModelShortDescription,
  getPlayerCaption,
  isApplicationPublic,
  isApplicationStatusUpdating,
  isExecutableApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';
import { getApplicationLink } from '@/src/utils/marketplace';

import { SimpleApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { AuthSelectors } from '@/src/store/auth/auth.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import {
  CardIconSizes,
  PlayerContextIconClasses,
  PlayerContextIcons,
} from '@/src/constants/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import ContextMenu from '@/src/components/Common/ContextMenu';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import ShareIcon from '@/src/components/Common/ShareIcon';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

import { AgentBookmark } from './AgentBookmark';
import { TopicsList } from './TopicsList';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

interface CardFooterProps {
  entity: DialAIEntityModel;
}

const CardFooter = ({ entity }: CardFooterProps) => {
  return (
    <>
      <EntityMarkdownDescription className="mt-3 hidden text-ellipsis text-sm leading-[18px] text-secondary md:line-clamp-2 xl:hidden">
        {getModelShortDescription(entity)}
      </EntityMarkdownDescription>
      <div className="flex flex-col gap-2 pt-3 md:pt-4">
        {/* <span className="text-sm leading-[21px] text-secondary">
        Capabilities: Conversation
      </span> */}

        <div className="w-full">
          {entity.topics && <TopicsList topics={entity.topics} />}
        </div>
      </div>
    </>
  );
};

export interface ApplicationCardProps {
  entity: DialAIEntityModel;
  onClick: (entity: DialAIEntityModel) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onLogsClick?: (entity: DialAIEntityModel) => void;
  isPreview?: boolean;
}

export const ApplicationCard = ({
  entity,
  onClick,
  onDelete,
  onEdit,
  onBookmarkClick,
  onPublish,
  onLogsClick,
  isPreview,
}: ApplicationCardProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();
  const screenState = useScreenState();

  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isApplicationPublic(entity);

  const canWrite = canWriteSharedWithMe(entity);

  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const isExecutable =
    isExecutableApp(entity) && (isMyApp || isAdmin || canWrite);

  const { iconSize, shareIconSize } = CardIconSizes[screenState];

  const PlayerContextIcon = PlayerContextIcons[playerStatus];

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

  const handleOpenApplicationLogs = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onLogsClick?.(entity);
    },
    [entity, onLogsClick],
  );

  const handleOpenSharing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(
        ShareActions.share({
          featureType: FeatureType.Application,
          resourceId: entity.id,
        }),
      );
    },
    [dispatch, entity.id],
  );

  const handleOpenUnshare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(ShareActions.setUnshareEntity(entity));
    },
    [dispatch, entity],
  );

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!navigator.clipboard) return;
      const link = getApplicationLink(entity);
      navigator.clipboard.writeText(link);
      dispatch(UIActions.showSuccessToast(t('Link copied!')));
    },
    [dispatch, entity, t],
  );

  const handleEdit = useMenuItemHandler(onEdit, entity);
  const handleDelete = useMenuItemHandler(onDelete, entity);
  const handlePublish = useMenuItemHandlerWithTwoArgs(
    onPublish,
    entity,
    PublishActions.ADD,
  );
  const handleUnpublish = useMenuItemHandlerWithTwoArgs(
    onPublish,
    entity,
    PublishActions.DELETE,
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Copy link'),
        dataQa: 'application-copy-link',
        display: isPublicApp,
        Icon: IconLink,
        onClick: handleCopy,
      },
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        display:
          (isAdmin || isMyApp || canWrite) &&
          !!entity.functionStatus &&
          isCodeAppsEnabled,
        Icon: PlayerContextIcon,
        iconClassName: PlayerContextIconClasses[playerStatus],
        onClick: handleUpdateFunctionStatus,
      },
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: ((isMyApp || !!canWrite) && !!onEdit) || !!isPreview,
        Icon: IconPencilMinus,
        onClick: handleEdit,
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display: isMyApp && isApplicationsSharingEnabled,
        Icon: IconUserShare,
        onClick: handleOpenSharing,
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display: !!entity.sharedWithMe && isApplicationsSharingEnabled,
        Icon: IconUserUnshare,
        onClick: handleOpenUnshare,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: (isMyApp && !!onPublish) || !!isPreview,
        Icon: IconWorldShare,
        onClick: handlePublish,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isEntityIdPublic(entity) && !!onPublish,
        Icon: UnpublishIcon,
        onClick: handleUnpublish,
      },
      {
        name: t('Logs'),
        dataQa: 'app-logs',
        display:
          !!isExecutable && playerStatus === SimpleApplicationStatus.UNDEPLOY,
        Icon: IconFileDescription,
        onClick: handleOpenApplicationLogs,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: (isMyApp && !!onDelete) || !!isPreview,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        iconClassName: 'stroke-error',
        onClick: handleDelete,
      },
    ],
    [
      t,
      isPublicApp,
      handleCopy,
      entity,
      playerStatus,
      isAdmin,
      isMyApp,
      isCodeAppsEnabled,
      PlayerContextIcon,
      handleUpdateFunctionStatus,
      canWrite,
      onEdit,
      handleEdit,
      isApplicationsSharingEnabled,
      handleOpenSharing,
      handleOpenUnshare,
      onPublish,
      handlePublish,
      handleUnpublish,
      isExecutable,
      handleOpenApplicationLogs,
      onDelete,
      isModifyDisabled,
      handleDelete,
      isPreview,
    ],
  );

  return (
    <div
      onClick={() => onClick(entity)}
      className={classNames(
        'group relative h-[98px] rounded-md bg-layer-2 p-3 shadow-card hover:bg-layer-3 md:h-[162px] md:p-4 xl:h-[164px] xl:p-5',
        !isPreview && 'cursor-pointer',
      )}
      data-qa="agent"
    >
      <div>
        <div className="absolute right-4 top-4 flex gap-1 xl:right-5 xl:top-5">
          {!isPreview && (
            <>
              <ContextMenu
                menuItems={menuItems}
                featureType={FeatureType.Application}
                triggerIconHighlight
                triggerIconSize={18}
                className="m-0 xl:invisible group-hover:xl:visible"
              />

              <AgentBookmark
                onBookmarkClick={onBookmarkClick}
                entity={entity}
              />
            </>
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
              <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
            </ShareIcon>
          </div>
          <div className="flex grow flex-col justify-center gap-2 overflow-hidden">
            {entity.version && (
              <div
                className={classNames(
                  'mr-6 flex gap-1 text-xs leading-[14px] text-secondary',
                  !isMyApp && '!mr-12',
                )}
              >
                {t('Version: ')}
                <span
                  className="max-w-full overflow-hidden truncate whitespace-nowrap"
                  data-qa="version"
                >
                  {entity.version}
                </span>
              </div>
            )}
            <div className="flex whitespace-nowrap">
              <div
                className={classNames(
                  'mr-6 flex shrink truncate text-base font-semibold leading-[20px] text-primary',
                  !isMyApp && !entity.version && '!mr-12',
                )}
              >
                <span className="truncate" data-qa="agent-name">
                  {entity.name}
                </span>
                <FunctionStatusIndicator entity={entity} />
              </div>
            </div>
            <EntityMarkdownDescription className="hidden text-ellipsis text-sm leading-[18px] text-secondary xl:!line-clamp-2">
              {getModelShortDescription(entity)}
            </EntityMarkdownDescription>
          </div>
        </div>
      </div>
      <CardFooter entity={entity} />
    </div>
  );
};
