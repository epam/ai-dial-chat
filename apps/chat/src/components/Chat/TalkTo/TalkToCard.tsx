import React, { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelShortDescription } from '@/src/utils/app/application';
import {
  isOldConversationReplay,
  isPlaybackConversation,
} from '@/src/utils/app/conversation';
import { isMyApplication } from '@/src/utils/app/id';
import { getGroupModelKey } from '@/src/utils/app/models';
import { PseudoModel, isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { CardIconSizes } from '@/src/constants/marketplace';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ShareIcon } from '@/src/components/Common/ShareIcon';
import { AgentContextMenu } from '@/src/components/Marketplace/AgentContextMenu';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

interface ApplicationCardProps {
  entity: DialAIEntityModel;
  conversation: Conversation;
  isSelected: boolean;
  disabled: boolean;
  isUnavailableModel: boolean;
  onClick: (entity: DialAIEntityModel) => void;
  onSelectVersion: (entity: DialAIEntityModel) => void;
}

const disabledActions = {
  copyLink: true,
  unpublish: true,
};

export const TalkToCard = ({
  entity,
  conversation,
  isSelected,
  disabled,
  isUnavailableModel,
  onClick,
  onSelectVersion,
}: ApplicationCardProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const allModels = useAppSelector(ModelsSelectors.selectModels);

  const isMyEntity = isMyApplication(entity);

  const screenState = useScreenState();

  const { iconSize, shareIconSize } = CardIconSizes[screenState];

  const versionsToSelect = useMemo(() => {
    return allModels.filter(
      (model) =>
        getGroupModelKey(entity) === getGroupModelKey(model) && entity.version,
    );
  }, [allModels, entity]);

  const handleSelectVersion = useCallback(
    (model: DialAIEntityModel) => {
      onSelectVersion(model);
    },
    [onSelectVersion],
  );

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
        <AgentContextMenu
          entity={entity}
          disabledActions={disabledActions}
          className="xl:invisible group-hover:xl:visible"
        />
      </div>
      <div className="flex items-end gap-4 overflow-hidden">
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
              <ShareIcon
                {...entity}
                isHighlighted={false}
                size={shareIconSize}
                featureType={FeatureType.Application}
                iconClassName="bg-layer-2 group-hover:bg-transparent"
                isMyEntity={isMyEntity}
              >
                <ModelIcon
                  entityId={entity.id}
                  entity={entity}
                  size={iconSize}
                />
              </ShareIcon>
            )}
        </div>
        <div className="flex grow flex-col justify-center gap-1 overflow-hidden leading-4 md:gap-2">
          {!!versionsToSelect.length && (
            <div className="flex items-center">
              <p className="mr-1 text-xs text-secondary">{t('Version')}: </p>
              <ModelVersionSelect
                readonly={isPlaybackConversation(conversation)}
                className="h-max truncate text-xs"
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
          {entity.topics && <TopicsList topics={entity.topics} />}
        </div>
      </div>
    </div>
  );
};
