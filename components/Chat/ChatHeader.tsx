import { IconX } from '@tabler/icons-react';
import { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import BroomIcon from '../../public/images/icons/broom.svg';
import GearIcon from '../../public/images/icons/gear.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';
import { ChatInfoTooltip } from './ChatInfoTooltip';

interface Props {
  conversation: Conversation;
  isCompareMode: boolean;
  selectedConversationIds: string[];
  messageIsStreaming: boolean;
  isShowChatInfo: boolean;
  isShowModelSelect: boolean;
  isShowClearConversation: boolean;
  isShowSettings: boolean;
  onClearConversation: () => void;
  onUnselectConversation: () => void;
  setShowSettings: (isShow: boolean) => void;
}

export const ChatHeader = ({
  conversation,
  isCompareMode,
  selectedConversationIds,
  messageIsStreaming,
  isShowChatInfo,
  isShowModelSelect,
  isShowClearConversation,
  isShowSettings,
  onClearConversation,
  onUnselectConversation,
  setShowSettings,
}: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: { modelsMap, addonsMap, lightMode },
  } = useContext(HomeContext);
  const [model, setModel] = useState<OpenAIEntityModel | undefined>(() => {
    return modelsMap[conversation.model.id];
  });

  useEffect(() => {
    setModel(modelsMap[conversation.model.id]);
  }, [modelsMap, conversation.model.id]);

  return (
    <>
      <div className="sticky top-0 z-10 flex w-full min-w-0 flex-col items-center justify-center gap-2 bg-gray-200 py-2 text-sm dark:bg-gray-800 lg:flex-row">
        {isShowChatInfo && (
          <Tooltip>
            <TooltipTrigger>
              <span className="block max-w-[330px] truncate text-center lg:max-w-[425px]">
                {conversation.name}
              </span>
            </TooltipTrigger>
            <TooltipContent>{conversation.name}</TooltipContent>
          </Tooltip>
        )}
        {model && (
          <div className="flex md:[&>*:first-child]:border-l-[1px] md:[&>*:not(:first-child)]:pl-2 [&>*:not(:last-child)]:border-r-[1px] [&>*:not(:last-child)]:pr-2 [&>*]:border-x-gray-500 [&>*]:pl-2">
            {isShowChatInfo && (
              <>
                <span className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger>
                      <ModelIcon
                        entityId={conversation.model.id}
                        entity={model}
                        size={18}
                        inverted={lightMode === 'dark'}
                        isCustomTooltip={true}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <ChatInfoTooltip
                        model={model}
                        selectedAddons={
                          model.type !== 'application'
                            ? (conversation.selectedAddons
                                .map((addon) => addonsMap[addon])
                                .filter(Boolean) as OpenAIEntityAddon[])
                            : null
                        }
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
                  conversation.selectedAddons.length > 0 && (
                    <span className="flex items-center">
                      {conversation.selectedAddons?.map((addon) => (
                        <ModelIcon
                          key={addon}
                          entityId={addon}
                          size={18}
                          entity={addonsMap[addon]}
                          inverted={lightMode === 'dark'}
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
                      className="cursor-pointer hover:opacity-50"
                      onClick={() => {
                        setShowSettings(!isShowSettings);
                      }}
                    >
                      <GearIcon width={18} height={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('Conversation settings')}</TooltipContent>
                </Tooltip>
              )}
              {isShowClearConversation && !isCompareMode && (
                <Tooltip isTriggerClickable={true}>
                  <TooltipTrigger>
                    <button
                      className="cursor-pointer hover:opacity-50"
                      onClick={onClearConversation}
                    >
                      <BroomIcon width={18} height={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('Clear conversation messages')}
                  </TooltipContent>
                </Tooltip>
              )}
              {isCompareMode && selectedConversationIds.length > 1 && (
                <button
                  className="cursor-pointer hover:opacity-50 disabled:cursor-not-allowed"
                  onClick={onUnselectConversation}
                  disabled={messageIsStreaming}
                >
                  <IconX size={18} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
