import { IconEraser, IconSettings, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import {
  getSelectedAddons,
  getValidEntitiesFromIds,
} from '@/src/utils/app/conversation';
import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { ModelIcon } from '../Chatbar/ModelIcon';
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
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

  const [model, setModel] = useState<DialAIEntityModel | undefined>(() => {
    return modelsMap[conversation.model.id];
  });
  const [isClearConversationModalOpen, setIsClearConversationModalOpen] =
    useState(false);

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

  const conversationSelectedAddons =
    conversation.selectedAddons?.filter(
      (id) => !model?.selectedAddons?.includes(id),
    ) || [];

  const iconSize = isSmallScreen() ? 20 : 18;
  const hideAddons = isSmallScreen() && conversationSelectedAddons.length > 2;

  return (
    <>
      <div
        className={classNames(
          'sticky top-0 z-10 flex w-full min-w-0 items-center justify-center gap-2 bg-layer-2 px-3 py-2 text-sm md:flex-wrap md:px-0 lg:flex-row',
          {
            'px-3 md:px-5 lg:flex-nowrap': isChatFullWidth,
          },
        )}
        data-qa="chat-header"
      >
        {isShowChatInfo && (
          <Tooltip
            tooltip={conversation.name}
            triggerClassName={classNames(
              'truncate text-center',
              isChatFullWidth
                ? 'flex h-full max-w-full items-center justify-center lg:max-w-[90%]'
                : '',
            )}
          >
            <span
              className={classNames(
                'truncate whitespace-pre text-center',
                {
                  'block max-w-full md:max-w-[330px] lg:max-w-[425px]':
                    !isChatFullWidth,
                },
                isConversationInvalid && 'text-secondary',
              )}
              data-qa="chat-title"
            >
              {conversation.name}
            </span>
          </Tooltip>
        )}
        <div className="flex lg:[&>*:first-child]:border-l-[1px] lg:[&>*:not(:first-child)]:pl-2 [&>*:not(:last-child)]:border-r-[1px] [&>*:not(:last-child)]:pr-2 [&>*]:border-x-primary [&>*]:pl-2">
          {isShowChatInfo && (
            <>
              <div>{model?.name}</div>
              <span className="flex items-center" data-qa="chat-model">
                <Tooltip
                  tooltip={
                    <ChatInfoTooltip
                      model={model ?? conversation.model}
                      selectedAddons={
                        model
                          ? selectedAddons
                          : getValidEntitiesFromIds(
                              conversation.selectedAddons,
                              addonsMap,
                            )
                      }
                      subModel={
                        model
                          ? conversation.assistantModelId &&
                            model.type === EntityType.Assistant
                            ? modelsMap[conversation.assistantModelId]
                            : null
                          : undefined
                      }
                      prompt={
                        !model || model.type === EntityType.Model
                          ? conversation.prompt
                          : null
                      }
                      temperature={
                        !model || model.type !== EntityType.Application
                          ? conversation.temperature
                          : null
                      }
                    />
                  }
                >
                  <ModelIcon
                    entityId={conversation.model.id}
                    entity={model}
                    size={iconSize}
                    isCustomTooltip
                    isInvalid={isConversationInvalid}
                  />
                </Tooltip>
              </span>
              {model ? (
                model.type !== EntityType.Application &&
                (conversation.selectedAddons.length > 0 ||
                  (model.selectedAddons &&
                    model.selectedAddons.length > 0)) && (
                  <span
                    className="flex items-center gap-2"
                    data-qa="chat-addons"
                  >
                    {model.selectedAddons?.map((addon) => (
                      <ModelIcon
                        key={addon}
                        entityId={addon}
                        size={18}
                        entity={addonsMap[addon]}
                      />
                    ))}
                    {hideAddons ? (
                      <>
                        <ModelIcon
                          entityId={conversationSelectedAddons[0]}
                          size={iconSize}
                          entity={addonsMap[conversationSelectedAddons[0]]}
                        />
                        <div className="flex size-5 items-center justify-center rounded bg-layer-4 text-[10px] md:size-[18px]">
                          +{conversationSelectedAddons.length - 1}
                        </div>
                      </>
                    ) : (
                      conversation.selectedAddons
                        ?.filter((id) => !model.selectedAddons?.includes(id))
                        .map((addon) => (
                          <ModelIcon
                            key={addon}
                            entityId={addon}
                            size={iconSize}
                            entity={addonsMap[addon]}
                          />
                        ))
                    )}
                  </span>
                )
              ) : (
                <>
                  {conversation.selectedAddons.length > 0 && (
                    <span
                      className="flex items-center gap-2"
                      data-qa="chat-addons"
                    >
                      {conversation.selectedAddons.map((addon) => (
                        <ModelIcon
                          key={addon}
                          entityId={addon}
                          size={iconSize}
                          entity={addonsMap[addon]}
                        />
                      ))}
                    </span>
                  )}
                </>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            {isShowModelSelect && !isConversationInvalid && (
              <Tooltip isTriggerClickable tooltip={t('Conversation settings')}>
                <button
                  className="cursor-pointer text-secondary hover:text-accent-primary"
                  onClick={() => setShowSettings(!isShowSettings)}
                  data-qa="conversation-setting"
                >
                  <IconSettings size={iconSize} />
                </button>
              </Tooltip>
            )}
            {isShowClearConversation &&
              !isConversationInvalid &&
              !isCompareMode && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t('Clear conversation messages')}
                >
                  <button
                    className="cursor-pointer text-secondary hover:text-accent-primary"
                    onClick={() => setIsClearConversationModalOpen(true)}
                    data-qa="clear-conversation"
                  >
                    <IconEraser size={iconSize} />
                  </button>
                </Tooltip>
              )}
            {isCompareMode && selectedConversationIds.length > 1 && (
              <Tooltip
                isTriggerClickable
                tooltip={t('Delete conversation from compare mode')}
              >
                <button
                  className="cursor-pointer text-secondary hover:text-accent-primary disabled:cursor-not-allowed"
                  onClick={() => onUnselectConversation(conversation.id)}
                  disabled={conversation.isMessageStreaming}
                  data-qa="delete-from-compare"
                >
                  <IconX size={18} />
                </button>
              </Tooltip>
            )}
            {isPlayback && (
              <button
                className="cursor-pointer text-accent-primary"
                onClick={onCancelPlaybackMode}
                data-qa="cancel-playback-mode"
              >
                {isSmallScreen() ? t('Stop') : t('Stop playback')}
              </button>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={isClearConversationModalOpen}
        heading={t('Confirm clearing all messages in the conversation')}
        description={
          t('Are you sure that you want to delete all messages?') || ''
        }
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsClearConversationModalOpen(false);
          if (result) {
            onClearConversation();
          }
        }}
      />
    </>
  );
};
