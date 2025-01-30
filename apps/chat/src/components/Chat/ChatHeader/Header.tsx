import {
  IconDotsVertical,
  IconEraser,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import {
  getSelectedAddons,
  getValidEntitiesFromIds,
} from '@/src/utils/app/conversation';
import {
  doesModelAllowAddons,
  doesModelAllowSystemPrompt,
  doesModelAllowTemperature,
  doesModelHaveSettings,
} from '@/src/utils/app/models';

import { Conversation } from '@/src/types/chat';
import { EntityType, ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { PublicVersionOption } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { FALLBACK_TEMPERATURE } from '@/src/constants/default-ui-settings';

import { ConversationContextMenu } from '@/src/components/Chat/ConversationContextMenu';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import Tooltip from '../../Common/Tooltip';
import { PublicVersionSelector } from '../Publish/PublicVersionSelector';
import { HeaderModelTooltip } from './HeaderModelTooltip';
import { HeaderSettingsTooltip } from './HeaderSettingsTooltip';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

interface Props {
  conversation: Conversation;
  isCompareMode: boolean;
  selectedConversationIds: string[];
  isShowChatInfo: boolean;
  isShowClearConversation: boolean;
  isShowSettings: boolean;
  onClearConversation: () => void;
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
    const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
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

    const selectedConversations = useAppSelector(
      ConversationsSelectors.selectSelectedConversations,
    );

    const [model, setModel] = useState<DialAIEntityModel | undefined>(() => {
      return modelsMap[conversation.model.id];
    });
    const [isClearConversationModalOpen, setIsClearConversationModalOpen] =
      useState(false);

    const { publicVersionGroupId, isReviewEntity } =
      usePublicVersionGroupId(conversation);

    const screenState = useScreenState();

    const isContextMenuVisible =
      isChatbarEnabled && !isSelectMode && !isTopContextMenuHidden;

    const selectedAddons = useMemo(
      () => getSelectedAddons(conversation.selectedAddons, addonsMap, model),
      [conversation, model, addonsMap],
    );
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
      (versionGroupId: string, newVersion: PublicVersionOption) => {
        dispatch(
          PublicationActions.setSelectedVersionForPublicVersionGroup({
            versionGroupId,
            newVersion,
          }),
        );
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [newVersion.id],
          }),
        );
      },
      [dispatch],
    );

    const conversationSelectedAddons =
      conversation.selectedAddons?.filter(
        (id) => !model?.selectedAddons?.includes(id),
      ) || [];

    const iconSize = screenState === ScreenState.MOBILE ? 20 : 18;
    const hideAddons =
      screenState === ScreenState.MOBILE &&
      conversationSelectedAddons.length > 2;
    const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

    const disallowChangeAgent = isChangeAgentDisallowed || isExternal;
    const disallowChangeSettings =
      conversation.replay?.replayAsIs || isPlayback || isExternal;

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
                  conversation.publicationInfo?.action ===
                    PublishActions.DELETE && 'text-error',
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
                  {!isReviewEntity ? (
                    <PublicVersionSelector
                      publicVersionGroupId={publicVersionGroupId}
                      onChangeSelectedVersion={handleChangeSelectedVersion}
                      selectedEntityId={conversation.id}
                    />
                  ) : (
                    <p
                      className={classNames(
                        conversation.publicationInfo?.action ===
                          PublishActions.DELETE && 'text-error',
                      )}
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
                    <button
                      className={classNames(
                        isMessageStreaming &&
                          !isChangeAgentDisallowed &&
                          'cursor-not-allowed',
                      )}
                      disabled={isMessageStreaming || disallowChangeAgent}
                      onClick={() => onModelClick(conversation.id)}
                    >
                      <ModelIcon
                        entityId={conversation.model.id}
                        entity={model}
                        size={iconSize}
                        isCustomTooltip
                      />
                    </button>
                  </Tooltip>
                </span>
                {model ? (
                  model.type !== EntityType.Application &&
                  doesModelAllowAddons(model) &&
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
                          <div className="flex size-5 items-center justify-center rounded bg-layer-4 text-xxs md:size-[18px]">
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
                    {doesModelAllowAddons(model) &&
                      conversation.selectedAddons.length > 0 && (
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
              {isTopChatModelSettingsEnabled && !isConversationInvalid && (
                <Tooltip
                  isTriggerClickable={
                    !(isMessageStreaming || disallowChangeSettings)
                  }
                  tooltip={
                    <HeaderSettingsTooltip
                      disallowChangeSettings={disallowChangeSettings}
                      hasSettings={!!doesModelHaveSettings(model)}
                      subModel={
                        conversation.assistantModelId &&
                        model?.type === EntityType.Assistant
                          ? modelsMap[conversation.assistantModelId]
                          : undefined
                      }
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
                      selectedAddons={
                        doesModelAllowAddons(model)
                          ? model
                            ? selectedAddons
                            : getValidEntitiesFromIds(
                                conversation.selectedAddons,
                                addonsMap,
                              )
                          : null
                      }
                    />
                  }
                >
                  <button
                    className="cursor-pointer text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                    onClick={() => setShowSettings(!isShowSettings)}
                    data-qa="conversation-setting"
                    disabled={isMessageStreaming || disallowChangeSettings}
                  >
                    <IconSettings size={iconSize} />
                  </button>
                </Tooltip>
              )}

              {isShowClearConversation &&
                !isConversationInvalid &&
                !isCompareMode && (
                  <Tooltip
                    isTriggerClickable={!isMessageStreaming}
                    tooltip={t('Clear conversation messages')}
                  >
                    <button
                      className="cursor-pointer text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                      onClick={() => setIsClearConversationModalOpen(true)}
                      data-qa="clear-conversation"
                      disabled={isMessageStreaming}
                    >
                      <IconEraser size={iconSize} />
                    </button>
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
                />
              )}

              {isPlayback && !isExternal && (
                <button
                  className="cursor-pointer text-accent-primary"
                  onClick={onCancelPlaybackMode}
                  data-qa="cancel-playback-mode"
                >
                  {screenState === ScreenState.MOBILE
                    ? t('Stop')
                    : t('Stop playback')}
                </button>
              )}

              {isCompareMode && selectedConversationIds.length > 1 && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t('Delete conversation from compare mode')}
                >
                  <button
                    className="cursor-pointer text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                    onClick={() => onUnselectConversation(conversation.id)}
                    disabled={isMessageStreaming}
                    data-qa="delete-from-compare"
                  >
                    <IconX size={18} />
                  </button>
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
              onClearConversation();
            }
          }}
        />
      </>
    );
  },
);
