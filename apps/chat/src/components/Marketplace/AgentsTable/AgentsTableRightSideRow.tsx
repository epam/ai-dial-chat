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
  PlayerContextIconClasses,
  PlayerContextIcons,
} from '@/src/constants/marketplace';

import ContextMenu from '@/src/components/Common/ContextMenu';
import Tooltip from '@/src/components/Common/Tooltip';

import { ApplicationTopic } from '../ApplicationTopic';
import { TopicsList } from '../TopicsList';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

export interface Props {
  entity: DialAIEntityModel;
  isHovered: boolean;
  onClick: (entity: DialAIEntityModel) => void;
  onRowHoverOver: () => void;
  onRowHover: (id: string) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onLogsClick?: (entity: DialAIEntityModel) => void;
}

export const AgentsTableRightSideRow: React.FC<Props> = memo(
  ({
    entity,
    isHovered,
    onClick,
    onRowHover,
    onRowHoverOver,
    onDelete,
    onEdit,
    onBookmarkClick,
    onPublish,
    onLogsClick,
  }) => {
    const { t } = useTranslation(Translation.Marketplace);

    const dispatch = useAppDispatch();

    const installedModelIds = useAppSelector(
      ModelsSelectors.selectInstalledModelIds,
    );
    const isCodeAppsEnabled = useAppSelector((state) =>
      SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
    );
    const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

    const screenState = useScreenState();

    const isMyApp = isMyApplication(entity);
    const isPublicApp = isApplicationPublic(entity);
    const canWrite = canWriteSharedWithMe(entity);
    const isModifyDisabled = isApplicationStatusUpdating(entity);
    const playerStatus = getApplicationSimpleStatus(entity);
    const isExecutable = isExecutableApp(entity) && (isMyApp || isAdmin);

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

    const { visibleTopics, hiddenTopics } = useMemo<{
      visibleTopics: string[];
      hiddenTopics: string[];
    }>(() => {
      if (!entity.topics) {
        return { visibleTopics: [], hiddenTopics: [] };
      }

      if (entity.topics?.length <= 3) {
        return { visibleTopics: entity.topics, hiddenTopics: [] };
      }

      return {
        visibleTopics: entity.topics.slice(0, 2),
        hiddenTopics: entity.topics.slice(2),
      };
    }, [entity.topics]);

    const Bookmark = installedModelIds.has(entity.reference)
      ? IconBookmarkFilled
      : IconBookmark;

    return (
      <li
        onClick={() => onClick(entity)}
        onMouseEnter={() => onRowHover(entity.id)}
        onMouseLeave={() => onRowHoverOver()}
        className={classNames(
          'relative flex h-[55px] min-w-full cursor-pointer gap-3 py-3 pl-4 pr-3 md:h-[115px] md:gap-5 md:p-4',
          isHovered && 'bg-layer-2',
        )}
      >
        <div className="flex w-[100px] min-w-[100px] items-center">
          <p className="truncate">{entity.version}</p>
        </div>
        <div className="flex w-[161px] min-w-[161px] flex-col justify-center gap-2 overflow-hidden">
          {screenState === ScreenState.MOBILE ? (
            <TopicsList topics={entity.topics ?? []} />
          ) : (
            <>
              {visibleTopics.map((topic) => (
                <ApplicationTopic key={topic} topic={topic} />
              ))}
              {!!hiddenTopics.length && (
                <Tooltip
                  triggerClassName="flex"
                  tooltip={
                    <div className="my-1 flex max-w-48 flex-wrap gap-2">
                      {hiddenTopics.map((topic) => (
                        <ApplicationTopic key={topic} topic={topic} />
                      ))}
                    </div>
                  }
                  placement="top"
                >
                  <span className="flex items-center rounded border border-accent-primary px-1.5 py-1 text-xs leading-3">
                    +{hiddenTopics.length}
                  </span>
                </Tooltip>
              )}
            </>
          )}
        </div>
        <div className="flex w-[130px] min-w-[130px] items-center">
          <p className="truncate">{entity.owner ?? t('Unknown')}</p>
        </div>
        <div className="flex w-[86px] min-w-[86px] items-center">
          <p className="truncate">
            {entity?.createdAt
              ? new Date(entity.createdAt).toLocaleDateString('en-GB')
              : t('Unknown')}
          </p>
        </div>
        <div className="hidden flex-none items-center xl:flex">
          <div className="flex gap-1">
            <Bookmark
              onClick={(e) => {
                e.stopPropagation();
                onBookmarkClick?.(entity);
              }}
              className="rounded text-secondary hover:text-accent-primary"
              size={18}
            />
            <ContextMenu
              menuItems={menuItems}
              featureType={FeatureType.Application}
              triggerIconHighlight
              triggerIconSize={18}
              className={classNames(
                'm-0',
                isHovered ? 'xl:visible' : 'xl:invisible',
              )}
            />
          </div>
        </div>
      </li>
    );
  },
);

AgentsTableRightSideRow.displayName = 'AgentsTableRightSideRow';
