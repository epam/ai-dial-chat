import { IconDoorExit, IconEraser, IconSettings, IconX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getSelectedAddons } from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';
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
  isPlayback: boolean;
  onCancelPlaybackMode: () => void;
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
  isPlayback,
  onCancelPlaybackMode,
}: Props) => {
  const { t } = useTranslation('chat');

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const theme = useAppSelector(UISelectors.selectThemeState);
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

  return (
    <>
      <div
        className="sticky top-0 z-10 flex w-full min-w-0 flex-wrap items-center justify-center gap-2 bg-gray-200 py-2 text-sm dark:bg-gray-800 lg:flex-row"
        data-qa="chat-header"
      >
        {isShowChatInfo && (
          <Tooltip>
            <TooltipTrigger>
              <span
                className="block max-w-[330px] truncate text-center lg:max-w-[425px]"
                data-qa="chat-title"
              >
                {conversation.name}
              </span>
            </TooltipTrigger>
            <TooltipContent>{conversation.name}</TooltipContent>
          </Tooltip>
        )}
        {model && (
          <div className="flex lg:[&>*:first-child]:border-l-[1px] lg:[&>*:not(:first-child)]:pl-2 [&>*:not(:last-child)]:border-r-[1px] [&>*:not(:last-child)]:pr-2 [&>*]:border-x-gray-500 [&>*]:pl-2">
            {isShowChatInfo && (
              <>
                <span className="flex items-center" data-qa="chat-model">
                  <Tooltip>
                    <TooltipTrigger>
                      <ModelIcon
                        entityId={conversation.model.id}
                        entity={model}
                        size={18}
                        inverted={theme === 'dark'}
                        isCustomTooltip={true}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <ChatInfoTooltip
                        model={model}
                        selectedAddons={selectedAddons}
                        subModel={
                          conversation.assistantModelId &&
                          model.type === 'assistant'
                            ? modelsMap[conversation.assistantModelId]
                            : null
                        }
                        prompt={
                          model.type === 'model' ? conversation.prompt : null
                        }
                        temperature={
                          model.type !== 'application'
                            ? conversation.temperature
                            : null
                        }
                      />
                    </TooltipContent>
                  </Tooltip>
                </span>
                {model.type !== 'application' &&
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
                          inverted={theme === 'dark'}
                        />
                      ))}
                      {conversation.selectedAddons
                        ?.filter(
                          (id) =>
                            addonsMap[id] &&
                            !model.selectedAddons?.includes(id),
                        )
                        .map((addon) => (
                          <ModelIcon
                            key={addon}
                            entityId={addon}
                            size={18}
                            entity={addonsMap[addon]}
                            inverted={theme === 'dark'}
                          />
                        ))}
                    </span>
                  )}
              </>
            )}
            <div className="flex items-center gap-2">
              {isShowModelSelect && (
                <Tooltip isTriggerClickable={true}>
                  <TooltipTrigger>
                    <button
                      className="cursor-pointer text-gray-500 hover:text-blue-500"
                      onClick={() => {
                        setShowSettings(!isShowSettings);
                      }}
                      data-qa="conversation-setting"
                    >
                      <IconSettings size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('Conversation settings')}</TooltipContent>
                </Tooltip>
              )}
              {isShowClearConversation && !isCompareMode && (
                <Tooltip isTriggerClickable={true}>
                  <TooltipTrigger>
                    <button
                      className="cursor-pointer text-gray-500 hover:text-blue-500"
                      onClick={onClearConversation}
                      data-qa="clear-conversation"
                    >
                      <IconEraser size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('Clear conversation messages')}
                  </TooltipContent>
                </Tooltip>
              )}
              {isCompareMode && selectedConversationIds.length > 1 && (
                <Tooltip isTriggerClickable={true}>
                  <TooltipTrigger>
                    <button
                      className="cursor-pointer text-gray-500 hover:text-blue-500 disabled:cursor-not-allowed"
                      onClick={() => onUnselectConversation(conversation.id)}
                      disabled={conversation.isMessageStreaming}
                      data-qa="remove-from-compare"
                    >
                      <IconX size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('Remove conversation from compare mode')}
                  </TooltipContent>
                </Tooltip>
              )}
              {isPlayback && <Tooltip isTriggerClickable={true}>
                  <TooltipTrigger>
                    <button
                      className="cursor-pointer text-gray-500 hover:text-blue-500"
                      onClick={onCancelPlaybackMode}
                      data-qa="cancel-playback-mode"
                    >
                      <IconDoorExit size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('To edit the chat, leave Playback mode')}
                  </TooltipContent>
                </Tooltip>}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
