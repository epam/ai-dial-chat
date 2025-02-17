import {
  IconBookmark,
  IconBookmarkFilled,
  IconFileDescription,
  IconLink,
  IconPencilMinus,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { memo, useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  useMenuItemHandler,
  useMenuItemHandlerWithTwoArgs,
} from '@/src/hooks/useHandler';
import { useScreenState } from '@/src/hooks/useScreenState';

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
import { FeatureType, ScreenState } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { AuthSelectors } from '@/src/store/auth/auth.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import {
  CardIconSizes,
  PlayerContextIconClasses,
  PlayerContextIcons,
} from '@/src/constants/marketplace';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../../Common/MarkdownDescription';
import { AgentTableRowItemProps } from './view-props';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

export const AgentsTableLeftSideRow: React.FC<AgentTableRowItemProps> = memo(
  ({
    entity,
    isHovered,
    onClick,
    onDelete,
    onEdit,
    onRowHover,
    onRowHoverOver,
    onBookmarkClick,
    onLogsClick,
    onPublish,
  }) => {
    const { t } = useTranslation(Translation.Marketplace);

    const dispatch = useAppDispatch();

    const screenState = useScreenState();

    const installedModelIds = useAppSelector(
      ModelsSelectors.selectInstalledModelIds,
    );
    const isCodeAppsEnabled = useAppSelector((state) =>
      SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
    );
    const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

    const isMyApp = isMyApplication(entity);
    const isPublicApp = isApplicationPublic(entity);
    const canWrite = canWriteSharedWithMe(entity);
    const isModifyDisabled = isApplicationStatusUpdating(entity);
    const playerStatus = getApplicationSimpleStatus(entity);
    const isExecutable = isExecutableApp(entity) && (isMyApp || isAdmin); //TODO add  ```|| canWrite``` when core issues #655 and #672 will be ready

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
            (isAdmin || isMyApp) &&
            !!entity.functionStatus &&
            isCodeAppsEnabled, //TODO add  canWrite when core issues #655 will be ready
          Icon: PlayerContextIcon,
          iconClassName: PlayerContextIconClasses[playerStatus],
          onClick: handleUpdateFunctionStatus,
        },
        {
          name: t('Edit'),
          dataQa: 'edit',
          display: (isMyApp || !!canWrite) && !!onEdit,
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
          display: isMyApp && !!onPublish,
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
          display: isMyApp && !!onDelete,
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
      ],
    );

    const Bookmark = installedModelIds.has(entity.reference)
      ? IconBookmarkFilled
      : IconBookmark;

    return (
      <li
        onClick={() => onClick(entity)}
        onMouseEnter={() => onRowHover(entity.id)}
        onMouseLeave={() => onRowHoverOver()}
        className={classNames(
          'flex h-[55px] cursor-pointer py-3 pl-3 pr-1 md:h-[115px] md:py-4 md:pl-4',
          isHovered && 'bg-layer-2',
        )}
      >
        <div className="flex h-full items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4">
            <Bookmark
              onClick={(e) => {
                e.stopPropagation();
                onBookmarkClick?.(entity);
              }}
              className="block shrink-0 rounded text-secondary hover:text-accent-primary xl:hidden"
              size={18}
            />
            <ModelIcon
              entityId={entity.id}
              entity={entity}
              size={screenState === ScreenState.MOBILE ? 30 : 60}
            />
          </div>
          <div>
            <div className="line-clamp-1 max-w-screen-sm text-base font-semibold leading-5">
              {entity.name}
            </div>
            <EntityMarkdownDescription className="mt-2 hidden max-w-screen-sm truncate whitespace-normal break-all !text-sm font-light !leading-[18px] text-secondary md:line-clamp-3">
              {getModelShortDescription(entity)}
            </EntityMarkdownDescription>
          </div>
        </div>
      </li>
    );
  },
);

AgentsTableLeftSideRow.displayName = 'AgentsTableLeftSideRow';
