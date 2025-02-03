import { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelDescription } from '@/src/utils/app/application';
import {
  getOpenAIEntityFullName,
  isOldConversationReplay,
} from '@/src/utils/app/conversation';
import { isEntityIdExternal } from '@/src/utils/app/id';

import { Conversation } from '@/src/types/chat';
import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { Spinner } from '../Common/Spinner';
import { FunctionStatusIndicator } from '../Marketplace/FunctionStatusIndicator';
import { ModelVersionSelect } from './ModelVersionSelect';
import { PlaybackIcon } from './Playback/PlaybackIcon';
import { ReplayAsIsIcon } from './ReplayAsIsIcon';

import { Feature } from '@epam/ai-dial-shared';

interface EmptyChatDescriptionViewProps {
  conversation: Conversation;
  onShowChangeModel: (conversationId: string) => void;
  onShowSettings: (show: boolean) => void;
}

const getModelName = (
  conversation: Conversation,
  model: DialAIEntityModel | undefined,
) => {
  if (conversation.playback?.isPlayback) {
    return 'Playback';
  }

  if (conversation.replay?.replayAsIs) {
    return 'Replay as is';
  }

  if (model) {
    return getOpenAIEntityFullName(model);
  }

  return conversation.model.id;
};

const EmptyChatDescriptionView = ({
  conversation,
  onShowChangeModel,
  onShowSettings,
}: EmptyChatDescriptionViewProps) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const screenState = useScreenState();

  const model = modelsMap[conversation.model.id];
  const versions = useMemo(
    () =>
      models.filter(
        (m) =>
          (installedModelIds.has(m.reference) ||
            model?.reference === m.reference) &&
          m.name === model?.name,
      ),
    [installedModelIds, model?.name, model?.reference, models],
  );

  const handleOpenChangeModel = useCallback(
    () => onShowChangeModel(conversation.id),
    [conversation.id, onShowChangeModel],
  );

  const handleOpenSettings = useCallback(
    () => onShowSettings(true),
    [onShowSettings],
  );

  const handleSelectVersion = useCallback(
    (model: DialAIEntityModel) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { model: { id: model.reference } },
        }),
      );
    },
    [conversation.id, dispatch],
  );

  if (models.length === 0) {
    return (
      <div className="flex w-full items-center justify-center rounded-t p-4">
        <Spinner size={16} className="mx-auto" />
      </div>
    );
  }

  const isReplayAsIs = conversation.replay?.replayAsIs;
  const isPlayback = conversation.playback?.isPlayback;
  const isEmptyChatChangeAgentHidden = enabledFeatures.has(
    Feature.HideEmptyChatChangeAgent,
  );
  const isEmptyChatSettingsEnabled = enabledFeatures.has(
    Feature.EmptyChatSettings,
  );
  const incorrectModel = !model;
  const isExternal = isEntityIdExternal(conversation);
  const modelIconSize = screenState === ScreenState.MOBILE ? 36 : 50;
  const isOldReplay = isOldConversationReplay(conversation.replay);
  const PseudoIcon = isPlayback
    ? PlaybackIcon
    : isReplayAsIs
      ? ReplayAsIsIcon
      : null;

  return (
    <div className="flex size-full flex-col items-center gap-5 rounded-t px-3 py-4 md:px-0 lg:max-w-3xl">
      <div
        data-qa="agent-name"
        className={classNames(
          'flex size-full justify-center whitespace-pre text-center',
          incorrectModel ? 'text-[40px]' : 'text-sm',
        )}
      >
        <div className="flex flex-col gap-3" data-qa="agent-info-container">
          <div
            className="flex flex-col items-center justify-center gap-5 text-3xl leading-10"
            data-qa="agent-info"
          >
            {PseudoIcon ? (
              <PseudoIcon size={modelIconSize} />
            ) : (
              <ModelIcon
                entity={model}
                entityId={model?.id ?? conversation.model.id}
                size={modelIconSize}
                isCustomTooltip
              />
            )}
            <div className="flex items-center gap-2 whitespace-pre-wrap">
              <span
                data-qa="agent-name"
                className={classNames(
                  incorrectModel &&
                    !isReplayAsIs &&
                    !isPlayback &&
                    'text-secondary',
                )}
              >
                {getModelName(conversation, model)}
              </span>
              {model && <FunctionStatusIndicator entity={model} />}
            </div>
          </div>
          {isReplayAsIs && (
            <>
              <span
                className="whitespace-pre-wrap text-secondary"
                data-qa="agent-descr"
              >
                <EntityMarkdownDescription
                  className="!text-base"
                  isShortDescription
                >
                  {t(
                    'This mode replicates user requests from the original conversation including settings set in each message.',
                  )}
                </EntityMarkdownDescription>
              </span>
              {isOldReplay && (
                <span className="text-error">
                  <EntityMarkdownDescription
                    className="!text-sm"
                    isShortDescription
                  >
                    {t(
                      'Some messages were created in an older DIAL version and may not replay as expected.',
                    )}
                  </EntityMarkdownDescription>
                </span>
              )}
            </>
          )}
          {model && !(isPlayback || isReplayAsIs) && (
            <>
              <ModelVersionSelect
                className="h-max w-fit self-center"
                entities={versions}
                onSelect={handleSelectVersion}
                currentEntity={model}
                showVersionPrefix
              />
              {!!getModelDescription(model) && (
                <span
                  className="whitespace-pre-wrap text-secondary"
                  data-qa="agent-descr"
                >
                  <EntityMarkdownDescription
                    className="!text-base"
                    isShortDescription
                  >
                    {getModelDescription(model)}
                  </EntityMarkdownDescription>
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {!isExternal && (
        <div className="flex gap-3 divide-x divide-primary leading-4">
          {!isEmptyChatChangeAgentHidden && (
            <button
              className="text-left text-accent-primary"
              data-qa="change-agent"
              onClick={handleOpenChangeModel}
            >
              {t('Change agent')}
            </button>
          )}
          {!isReplayAsIs && !isPlayback && isEmptyChatSettingsEnabled && (
            <button
              className="pl-3 text-left text-accent-primary"
              data-qa="configure-settings"
              onClick={handleOpenSettings}
            >
              {t('Configure settings')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface Props {
  conversation: Conversation;
  onShowChangeModel: (conversationId: string) => void;
  onShowSettings: (show: boolean) => void;
}

export const EmptyChatDescription = ({
  conversation,
  onShowChangeModel,
  onShowSettings,
}: Props) => {
  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-px rounded">
        <EmptyChatDescriptionView
          conversation={conversation}
          onShowChangeModel={onShowChangeModel}
          onShowSettings={onShowSettings}
        />
      </div>
    </div>
  );
};
