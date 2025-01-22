import {
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
import { isOldConversationReplay } from '@/src/utils/app/conversation';
import { getRootId } from '@/src/utils/app/id';
import { canWriteSharedWithMe } from '@/src/utils/app/share';
import { PseudoModel, isPseudoModel } from '@/src/utils/server/api';

import {
  ApplicationStatus,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
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

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import ContextMenu from '@/src/components/Common/ContextMenu';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ApplicationTopic } from '@/src/components/Marketplace/ApplicationTopic';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

import UnshareDialog from '../../Common/UnshareDialog';

import LoaderIcon from '@/public/images/icons/loader.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature } from '@epam/ai-dial-shared';

const DESKTOP_ICON_SIZE = 80;
const TABLET_ICON_SIZE = 48;
const MOBILE_ICON_SIZE = 40;

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
  conversation: Conversation;
  isSelected: boolean;
  disabled: boolean;
  isUnavailableModel: boolean;
  onClick: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onEdit: (entity: DialAIEntityModel) => void;
  onSelectVersion: (entity: DialAIEntityModel) => void;
  onOpenLogs: (entity: DialAIEntityModel) => void;
}

export const TalkToCard = ({
  entity,
  conversation,
  isSelected,
  disabled,
  isUnavailableModel,
  onClick,
  onDelete,
  onEdit,
  onPublish,
  onSelectVersion,
  onOpenLogs,
}: ApplicationCardProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const [isUnshareConfirmOpened, setIsUnshareConfirmOpened] = useState(false);

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const isMyEntity = entity.id.startsWith(
    getRootId({ featureType: FeatureType.Application }),
  );

  const canWrite = canWriteSharedWithMe(entity);

  const isExecutable =
    isExecutableApp(entity) && (isMyEntity || isAdmin || canWrite);
  const screenState = useScreenState();

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const versionsToSelect = useMemo(() => {
    return allModels.filter(
      (model) =>
        entity.name === model.name &&
        entity.version &&
        (installedModelIds.has(model.reference) ||
          (isSelected && entity.reference === model.reference)),
    );
  }, [
    allModels,
    entity.name,
    entity.reference,
    entity.version,
    installedModelIds,
    isSelected,
  ]);

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

  const handleSelectVersion = useCallback(
    (model: DialAIEntityModel) => {
      onSelectVersion(model);
    },
    [onSelectVersion],
  );

  const handleOpenSharing = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Application,
        resourceId: entity.id,
      }),
    );
  }, [dispatch, entity.id]);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        display:
          (isAdmin || isMyEntity) &&
          !!entity.functionStatus &&
          isCodeAppsEnabled,
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
        display: (isMyEntity || !!canWrite) && !!onEdit,
        Icon: IconPencilMinus,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onEdit(entity);
        },
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display: isMyEntity && isApplicationsSharingEnabled,
        Icon: IconUserShare,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          handleOpenSharing();
        },
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display:
          (!!entity.sharedWithMe || !!entity.isShared) &&
          isApplicationsSharingEnabled,
        Icon: IconUserUnshare,
        onClick: (e: React.MouseEvent) => {
          setIsUnshareConfirmOpened(true);
          e.stopPropagation();
        },
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isMyEntity && !!onPublish,
        Icon: IconWorldShare,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onPublish(entity);
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
          onOpenLogs(entity);
        },
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyEntity && !!onDelete,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        iconClassName: 'stroke-error',
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete(entity);
        },
      },
    ],
    [
      t,
      entity,
      playerStatus,
      isAdmin,
      isMyEntity,
      isCodeAppsEnabled,
      PlayerIcon,
      onEdit,
      canWrite,
      isApplicationsSharingEnabled,
      onPublish,
      isExecutable,
      onDelete,
      isModifyDisabled,
      handleUpdateFunctionStatus,
      handleOpenSharing,
      onOpenLogs,
    ],
  );

  const iconSize =
    screenState === ScreenState.DESKTOP
      ? DESKTOP_ICON_SIZE
      : screenState === ScreenState.TABLET
        ? TABLET_ICON_SIZE
        : MOBILE_ICON_SIZE;
  const isOldReplay =
    entity.id === REPLAY_AS_IS_MODEL &&
    isOldConversationReplay(conversation.replay);

  return (
    <div
      onClick={() => {
        if (!disabled) {
          onClick(entity);
        }
      }}
      className={classNames(
        'group relative flex flex-col rounded-md border bg-layer-2 p-[11px] md:p-[15px] xl:p-[19px]',
        isSelected && !isUnavailableModel && 'border-accent-primary',
        !isSelected && 'border-primary',
        isUnavailableModel && 'border-error',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-layer-3',
        isOldReplay && 'pb-2',
      )}
      aria-selected={isSelected}
      data-qa="agent"
    >
      <div className="absolute right-4 top-4 flex cursor-pointer gap-1 xl:right-5 xl:top-5">
        <ContextMenu
          menuItems={menuItems}
          featureType={FeatureType.Application}
          triggerIconHighlight
          triggerIconSize={18}
          className="m-0 xl:invisible group-hover:xl:visible"
        />
      </div>
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="flex shrink-0 items-center justify-center xl:my-[3px]">
          {entity.reference === PseudoModel.Playback && (
            <span
              className="shrink-0 rounded-full bg-model-icon"
              style={{
                height: `${iconSize}px`,
                width: `${iconSize}px`,
              }}
            >
              <PlaybackIcon size={iconSize} />
            </span>
          )}
          {entity.reference === REPLAY_AS_IS_MODEL && (
            <ReplayAsIsIcon size={iconSize} />
          )}
          {!isPseudoModel(entity.reference) &&
            entity.reference !== REPLAY_AS_IS_MODEL && (
              <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
            )}
        </div>
        <div className="flex grow flex-col justify-center gap-2 overflow-hidden leading-4">
          {!!versionsToSelect.length && (
            <div className="flex items-center">
              <p className="mr-1 text-xs text-secondary">{t('Version')}: </p>
              <ModelVersionSelect
                readonly={conversation.playback?.isPlayback}
                className="h-max text-xs"
                entities={versionsToSelect}
                onSelect={handleSelectVersion}
                currentEntity={entity}
              />
            </div>
          )}
          <div className="flex whitespace-nowrap">
            <div
              className={classNames(
                'shrink truncate text-base font-semibold leading-[19px] text-primary',
                !isMyEntity && !entity.version && 'mr-6',
                isUnavailableModel ? 'text-secondary' : 'text-primary',
              )}
              data-qa="agent-name"
            >
              {entity.name}
            </div>
            <FunctionStatusIndicator entity={entity} />
          </div>
          <EntityMarkdownDescription
            className={classNames(
              'hidden text-ellipsis text-sm leading-4',
              isUnavailableModel ? 'text-error' : 'text-secondary',
              entity.id !== REPLAY_AS_IS_MODEL
                ? 'xl:!line-clamp-2'
                : 'xl:block',
            )}
          >
            {getModelShortDescription(entity)}
          </EntityMarkdownDescription>
        </div>
      </div>
      <EntityMarkdownDescription
        className={classNames(
          'mt-3 hidden text-ellipsis text-sm leading-4 md:line-clamp-2 xl:hidden',
          isUnavailableModel ? 'text-error' : 'text-secondary',
        )}
      >
        {getModelShortDescription(entity)}
      </EntityMarkdownDescription>
      <div className="mt-auto">
        <div
          className={classNames(
            'mt-3 flex grow gap-2 overflow-hidden',
            isOldReplay ? 'mt-1.5 md:mt-1 xl:mt-2' : 'xl:mt-4',
          )}
        >
          {isOldReplay && (
            <span className="text-xs leading-[15px] text-error">
              {t(
                'Some messages were created in an older DIAL version and may not replay as expected.',
              )}
            </span>
          )}
          {entity.topics?.map((topic) => (
            <ApplicationTopic key={topic} topic={topic} />
          ))}
        </div>
      </div>
      {isUnshareConfirmOpened && (
        <UnshareDialog entity={entity} setOpened={setIsUnshareConfirmOpened} />
      )}
    </div>
  );
};
