import {
  IconDotsVertical,
  IconEraser,
  IconSettings,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import { isReplayAsIsConversation } from '@/src/utils/app/conversation';
import {
  doesModelAllowSystemPrompt,
  doesModelAllowTemperature,
  doesModelHaveSettings,
} from '@/src/utils/app/models';

import { Conversation } from '@/src/types/chat';
import { EntityType, ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  ModelsSelectors,
  PublicationSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { FALLBACK_TEMPERATURE } from '@/src/constants/default-ui-settings';

import { ConversationContextMenu } from '@/src/components/Chat/ConversationContextMenu';
import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { HeaderModelTooltip } from './HeaderModelTooltip';
import { HeaderSettingsTooltip } from './HeaderSettingsTooltip';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature, PublishActions } from '@epam/ai-dial-shared';
import { DialButton, DialCloseButton } from '@epam/ai-dial-ui-kit';

interface Props {
  conversation: Conversation;
  isCompareMode: boolean;
  selectedConversationIds: string[];
  isShowChatInfo: boolean;
  isShowClearConversation: boolean;
  isShowSettings: boolean;
  onClearConversation: (conversation: Conversation) => void;
  onUnselectConversation: (conversationId: string) => void;
  setShowSettings: (isShow: boolean) => void;
  onModelClick: (conversationId: string) => void;
}

export const ChatHeader = Inversify.register(
  'ChatHeader',
  ({
    conversation,
    isCompareMode,
    selectedConversationIds,
    isShowChatInfo,
    isShowClearConversation,
    isShowSettings,
    onClearConversation,
    onUnselectConversation,
    setShowSettings,
    onModelClick,
  }: Props) => {
    const { t } = useTranslation(Translation.Chat);

    const dispatch = useAppDispatch();

    const [isContextMenu, setIsContextMenu] = useState(false);

    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
    const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
    const isPlayback = useAppSelector(
      ConversationsSelectors.selectIsPlaybackSelectedConversations,
    );
    const isExternal = useAppSelector(
      ConversationsSelectors.selectAreSelectedConversationsExternal,
    );
    const isSelectMode = useAppSelector(
      ConversationsSelectors.selectIsSelectMode,
    );
    const enabledFeatures = useAppSelector(
      SettingsSelectors.selectEnabledFeatures,
    );
    const selectedConversations = useAppSelector(
      ConversationsSelectors.selectSelectedConversations,
    );
    const isApproveRequiredEntitySelected = useAppSelector((state) =>
      PublicationSelectors.selectIsApproveRequiredEntitySelected(
        state,
        conversation.id,
      ),
    );
    const publicationUrl = useAppSelector(
      PublicationSelectors.selectSelectedPublicationUrl,
    );

    const isTopChatModelSettingsEnabled = enabledFeatures.has(
      Feature.TopChatModelSettings,
    );
    const isTopContextMenuHidden = enabledFeatures.has(
      Feature.HideTopContextMenu,
    );
    const isChangeAgentDisallowed = enabledFeatures.has(
      Feature.DisallowChangeAgent,
    );
    const isChatbarEnabled = enabledFeatures.has(Feature.ConversationsSection);

    const [model, setModel] = useState<DialAIEntityModel | undefined>(() => {
      return modelsMap[conversation.model.id];
    });

    const [isClearConversationModalOpen, setIsClearConversationModalOpen] =
      useState(false);

    const publicVersionGroupId = usePublicVersionGroupId(conversation);

    const screenState = useScreenState();

    const isContextMenuVisible =
      isChatbarEnabled && !isSelectMode && !isTopContextMenuHidden;

    const isMessageStreaming = useMemo(
      () => selectedConversations.some((conv) => conv.isMessageStreaming),
      [selectedConversations],
    );

    useEffect(() => {
      setModel(modelsMap[conversation.model.id]);
    }, [modelsMap, conversation.model.id]);

    const onCancelPlaybackMode = useCallback(() => {
      dispatch(ConversationsActions.playbackCancel());
    }, [dispatch]);

    const handleChangeSelectedVersion = useCallback(
      (newVersionId: string) => {
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [newVersionId],
          }),
        );
      },
      [dispatch],
    );

    const iconSize = screenState === ScreenState.SM ? 20 : 18;
    const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

    const disallowChangeAgent =
      isChangeAgentDisallowed ||
      conversation.publicationInfo?.action === PublishActions.DELETE ||
      (isExternal && !isApproveRequiredEntitySelected);
    const disallowChangeSettings =
      isReplayAsIsConversation(conversation) ||
      isPlayback ||
      conversation.publicationInfo?.action === PublishActions.DELETE ||
      (isExternal && !isApproveRequiredEntitySelected);
    const isUnpublishing =
      conversation.publicationInfo?.action === PublishActions.DELETE &&
      isApproveRequiredEntitySelected;

    return (
      <>
        <div
          className={classNames(
            'sticky top-0 z-10 flex w-full min-w-0 items-center justify-center gap-2 bg-layer-2 px-3 py-2 text-sm md:flex-wrap md:px-0 lg:flex-row',
            isChatFullWidth && 'px-3 md:px-5 lg:flex-nowrap',
          )}
          data-qa="chat-header"
        >
          {isShowChatInfo && (
            <>
              <Tooltip
                tooltip={conversation.name}
                triggerClassName={classNames(
                  'truncate text-center',
                  isChatFullWidth &&
                    'flex h-full max-w-full items-center justify-center lg:max-w-[90%]',
                  isUnpublishing && 'text-error',
                )}
              >
                <span
                  className={classNames(
                    'truncate whitespace-pre text-center',
                    !isChatFullWidth &&
                      'block max-w-full md:max-w-[330px] lg:max-w-[425px]',
                    isConversationInvalid && 'text-secondary',
                  )}
                  data-qa="chat-title"
                >
                  {conversation.name}
                </span>
              </Tooltip>
              {publicVersionGroupId && (
                <span className="h-[18px] border-l border-l-primary pl-2">
                  {!isApproveRequiredEntitySelected ? (
                    <PublicVersionSelector
                      publicVersionGroupId={publicVersionGroupId}
                      onChangeSelectedVersion={handleChangeSelectedVersion}
                      selectedEntityId={conversation.id}
                    />
                  ) : (
                    <p
                      className={classNames(isUnpublishing && 'text-error')}
                      data-qa="version"
                    >
                      {t('v.')} {conversation.publicationInfo?.version}
                    </p>
                  )}
                </span>
              )}
            </>
          )}
          <div className="flex lg:[&>*:first-child]:border-l lg:[&>*:not(:first-child)]:pl-2 [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:pr-2 [&>*]:border-x-primary [&>*]:pl-2">
            {isShowChatInfo && (
              <>
                <span className="flex items-center" data-qa="chat-model">
                  <Tooltip
                    isTriggerClickable={
                      !(isMessageStreaming || disallowChangeAgent)
                    }
                    tooltip={
                      <HeaderModelTooltip
                        model={model}
                        conversationModelId={conversation.model.id}
                        disallowChangeAgent={disallowChangeAgent}
                      />
                    }
                  >
                    <DialButton
                      disabled={isMessageStreaming || disallowChangeAgent}
                      onClick={() => onModelClick(conversation.id)}
                      iconBefore={
                        <ModelIcon
                          entityId={conversation.model.id}
                          entity={model}
                          size={iconSize}
                          isCustomTooltip
                        />
                      }
                    />
                  </Tooltip>
                </span>
              </>
            )}
            <div className="flex items-center gap-2">
              {isTopChatModelSettingsEnabled && !isConversationInvalid && (
                <Tooltip
                  isTriggerClickable={
                    !(isMessageStreaming || disallowChangeSettings)
                  }
                  tooltip={
                    <HeaderSettingsTooltip
                      disallowChangeSettings={disallowChangeSettings}
                      hasSettings={!!doesModelHaveSettings(model)}
                      systemPrompt={
                        model?.type === EntityType.Model &&
                        doesModelAllowSystemPrompt(model)
                          ? conversation.prompt
                          : ''
                      }
                      temperature={
                        model?.type !== EntityType.Application
                          ? doesModelAllowTemperature(model)
                            ? conversation.temperature
                            : FALLBACK_TEMPERATURE
                          : null
                      }
                    />
                  }
                >
                  <DialButton
                    className="cursor-pointer text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                    onClick={() => setShowSettings(!isShowSettings)}
                    data-qa="conversation-setting"
                    disabled={isMessageStreaming || disallowChangeSettings}
                    iconBefore={<IconSettings size={iconSize} />}
                  />
                </Tooltip>
              )}

              {isShowClearConversation &&
                !isConversationInvalid &&
                !isCompareMode &&
                !conversation.publishedWithMe && (
                  <Tooltip
                    isTriggerClickable={!isMessageStreaming}
                    tooltip={t('Clear conversation messages')}
                  >
                    <DialButton
                      className="text-secondary hover:text-accent-primary"
                      onClick={() => setIsClearConversationModalOpen(true)}
                      data-qa="clear-conversation"
                      disabled={isMessageStreaming}
                      iconBefore={<IconEraser size={iconSize} />}
                    />
                  </Tooltip>
                )}

              {isContextMenuVisible && (
                <ConversationContextMenu
                  conversation={conversation}
                  isOpen={isContextMenu}
                  setIsOpen={setIsContextMenu}
                  className="cursor-pointer text-secondary group-hover:text-accent-primary group-disabled:cursor-not-allowed group-disabled:text-controls-disable"
                  TriggerIcon={IconDotsVertical}
                  isHeaderMenu
                  disabledState={isMessageStreaming}
                  publicationUrl={publicationUrl ?? undefined}
                />
              )}

              {isPlayback && !isExternal && (
                <DialButton
                  className="text-accent-primary"
                  onClick={onCancelPlaybackMode}
                  data-qa="cancel-playback-mode"
                  label={
                    screenState === ScreenState.SM
                      ? t('Stop')
                      : t('Stop playback')
                  }
                />
              )}

              {isCompareMode && selectedConversationIds.length > 1 && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t('Delete conversation from compare mode')}
                >
                  <DialCloseButton
                    onClose={() => onUnselectConversation(conversation.id)}
                    disabled={isMessageStreaming}
                    data-qa="delete-from-compare"
                    size={18}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <ConfirmDialog
          isOpen={isClearConversationModalOpen}
          heading={t('Confirm deleting all messages in the conversation')}
          description={t('Are you sure that you want to delete all messages?')}
          confirmLabel={t('Delete')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsClearConversationModalOpen(false);
            if (result) {
              onClearConversation(conversation);
            }
          }}
        />
      </>
    );
  },
);
