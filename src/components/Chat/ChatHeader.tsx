import {
  IconDoorExit,
  IconEraser,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getSelectedAddons } from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import Tooltip from '../Common/Tooltip';
import { ChatInfoTooltip } from './ChatInfoTooltip';

interface Props {
  conversation: Conversation;
  isCompareMode: boolean;
  selectedConversationIds: string[];
  isShowChatInfo: boolean;
  isShowModelSelect: boolean;
  isShowClearConversation: boolean;
  isShowSettings: boolean;
  onClearConversation: () => void;
  onUnselectConversation: (conversationId: string) => void;
  setShowSettings: (isShow: boolean) => void;
}

export const ChatHeader = ({
  conversation,
  isCompareMode,
  selectedConversationIds,
  isShowChatInfo,
  isShowModelSelect,
  isShowClearConversation,
  isShowSettings,
  onClearConversation,
  onUnselectConversation,
  setShowSettings,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const [model, setModel] = useState<OpenAIEntityModel | undefined>(() => {
    return modelsMap[conversation.model.id];
  });

  const selectedAddons = useMemo(
    () => getSelectedAddons(conversation.selectedAddons, addonsMap, model),
    [conversation, model, addonsMap],
  );

  useEffect(() => {
    setModel(modelsMap[conversation.model.id]);
  }, [modelsMap, conversation.model.id]);

  const onCancelPlaybackMode = useCallback(() => {
    dispatch(ConversationsActions.playbackCancel());
  }, [dispatch]);

  return (
    <>
      <div
        className="sticky top-0 z-10 flex w-full min-w-0 flex-wrap items-center justify-center gap-2 bg-layer-2 py-2 text-sm lg:flex-row"
        data-qa="chat-header"
      >
        {isShowChatInfo && (
          <Tooltip tooltip={conversation.name}>
            <span
              className="block max-w-[330px] truncate text-center lg:max-w-[425px]"
              data-qa="chat-title"
            >
              {conversation.name}
            </span>
          </Tooltip>
        )}
        {model && (
          <div className="flex lg:[&>*:first-child]:border-l-[1px] lg:[&>*:not(:first-child)]:pl-2 [&>*:not(:last-child)]:border-r-[1px] [&>*:not(:last-child)]:pr-2 [&>*]:border-x-secondary [&>*]:pl-2">
            {isShowChatInfo && (
              <>
                <span className="flex items-center" data-qa="chat-model">
                  <Tooltip
                    tooltip={
                      <ChatInfoTooltip
                        model={model}
                        selectedAddons={selectedAddons}
                        subModel={
                          conversation.assistantModelId &&
                          model.type === EntityType.Assistant
                            ? modelsMap[conversation.assistantModelId]
                            : null
                        }
                        prompt={
                          model.type === EntityType.Model
                            ? conversation.prompt
                            : null
                        }
                        temperature={
                          model.type !== EntityType.Application
                            ? conversation.temperature
                            : null
                        }
                      />
                    }
                  >
                    <ModelIcon
                      entityId={conversation.model.id}
                      entity={model}
                      size={18}
                      isCustomTooltip
                    />
                  </Tooltip>
                </span>
                {model.type !== EntityType.Application &&
                  (conversation.selectedAddons.length > 0 ||
                    (model.selectedAddons &&
                      model.selectedAddons.length > 0)) && (
                    <span className="flex items-center gap-2">
                      {model.selectedAddons?.map((addon) => (
                        <ModelIcon
                          key={addon}
                          entityId={addon}
                          size={18}
                          entity={addonsMap[addon]}
                        />
                      ))}
                      {conversation.selectedAddons
                        ?.filter((id) => !model.selectedAddons?.includes(id))
                        .map((addon) => (
                          <ModelIcon
                            key={addon}
                            entityId={addon}
                            size={18}
                            entity={addonsMap[addon]}
                          />
                        ))}
                    </span>
                  )}
              </>
            )}
            <div className="flex items-center gap-2">
              {isShowModelSelect && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t('Conversation settings')}
                >
                  <button
                    className="cursor-pointer text-secondary hover:text-accent-primary"
                    onClick={() => {
                      setShowSettings(!isShowSettings);
                    }}
                    data-qa="conversation-setting"
                  >
                    <IconSettings size={18} />
                  </button>
                </Tooltip>
              )}
              {isShowClearConversation && !isCompareMode && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t('Clear conversation messages')}
                >
                  <button
                    className="cursor-pointer text-secondary hover:text-accent-primary"
                    onClick={onClearConversation}
                    data-qa="clear-conversation"
                  >
                    <IconEraser size={18} />
                  </button>
                </Tooltip>
              )}
              {isCompareMode && selectedConversationIds.length > 1 && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t('Remove conversation from compare mode')}
                >
                  <button
                    className="cursor-pointer text-secondary hover:text-accent-primary disabled:cursor-not-allowed"
                    onClick={() => onUnselectConversation(conversation.id)}
                    disabled={conversation.isMessageStreaming}
                    data-qa="remove-from-compare"
                  >
                    <IconX size={18} />
                  </button>
                </Tooltip>
              )}
              {isPlayback && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t('To edit the chat, leave Playback mode')}
                >
                  <button
                    className="cursor-pointer text-secondary hover:text-accent-primary"
                    onClick={onCancelPlaybackMode}
                    data-qa="cancel-playback-mode"
                  >
                    <IconDoorExit size={18} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
