import {
  IconDotsVertical,
  IconEraser,
  IconSettings,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useFloatingPanelTogglePadding } from '@/src/hooks/useFloatingPanelTogglePadding';
import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import { isReplayAsIsConversation } from '@/src/utils/app/conversation';
import { translateConversationDisplayName } from '@/src/utils/app/translateConversationDisplayName';
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
import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ConversationContextMenu } from '@/src/components/Chat/ConversationContextMenu';
import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { HeaderModelTooltip } from './HeaderModelTooltip';
import { HeaderSettingsTooltip } from './HeaderSettingsTooltip';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import {
  ConversationResponseFormat,
  Feature,
  PublishActions,
} from '@epam/ai-dial-shared';
import {
  DialButton,
  DialGhostIconButton,
  DialLinkButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';

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
    const router = useRouter();
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
    const {
      hasFloatingPanelToggles,
      headerClassNames: headerClassNamesWithFloatingPanelToggles,
    } = useFloatingPanelTogglePadding();
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
    const isChatHeaderBorderEnabled = enabledFeatures.has(
      Feature.ChatHeaderBorder,
    );

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

    const displayName = useMemo(
      () =>
        translateConversationDisplayName(conversation.name, router.locale, t),
      [conversation.name, router.locale, t],
    );

    return (
      <>
        <div
          className={classNames(
            'sticky top-0 z-10 flex w-full min-w-0 items-center justify-center gap-2 bg-layer-2 text-sm md:flex-wrap md:px-0 lg:flex-row',
            isChatHeaderBorderEnabled && 'border-b border-secondary',
            isChatFullWidth && !hasFloatingPanelToggles && 'px-3 md:px-5',
            isChatFullWidth && 'lg:flex-nowrap',
            hasFloatingPanelToggles && headerClassNamesWithFloatingPanelToggles
              ? headerClassNamesWithFloatingPanelToggles
              : 'px-3 py-2',
          )}
          data-qa="chat-header"
        >
          {isShowChatInfo && (
            <>
              <Tooltip
                tooltip={displayName}
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
                  {displayName}
                </span>
              </Tooltip>
              {publicVersionGroupId && (
                <span className="h-[18px] min-w-fit border-s border-s-primary ps-2">
                  {!isApproveRequiredEntitySelected ? (
                    <PublicVersionSelector
                      publicVersionGroupId={publicVersionGroupId}
                      onChangeSelectedVersion={handleChangeSelectedVersion}
                      selectedEntityId={conversation.id}
                      btnClassNames="!text-primary"
                    />
                  ) : (
                    <p
                      className={classNames(isUnpublishing && 'text-error')}
                      data-qa="version"
                    >
                      {t(ChatI18nKeys.VersionPrefix)}{' '}
                      {conversation.publicationInfo?.version}
                    </p>
                  )}
                </span>
              )}
            </>
          )}
          <div className="flex lg:[&>*:first-child]:border-s lg:[&>*:not(:first-child)]:ps-2 [&>*:not(:last-child)]:border-e [&>*:not(:last-child)]:pe-2 [&>*]:border-x-primary [&>*]:ps-2">
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
                      className="h-fit px-0"
                      disabled={isMessageStreaming || disallowChangeAgent}
                      onClick={() => onModelClick(conversation.id)}
                      iconBefore={
                        <ModelIcon
                          entityId={conversation.model.id}
                          entity={model}
                          size={screenState === ScreenState.SM ? 20 : 18}
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
                      responseFormat={
                        conversation.responseFormat ??
                        ConversationResponseFormat.Markdown
                      }
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
                  <DialGhostIconButton
                    size={ElementSize.Small}
                    onClick={() => setShowSettings(!isShowSettings)}
                    data-qa="conversation-setting"
                    disabled={isMessageStreaming || disallowChangeSettings}
                    icon={<IconSettings size={DEFAULT_ICON_SIZES.SMALL} />}
                  />
                </Tooltip>
              )}

              {isShowClearConversation &&
                !isConversationInvalid &&
                !isCompareMode &&
                !conversation.publishedWithMe && (
                  <Tooltip
                    isTriggerClickable={!isMessageStreaming}
                    tooltip={t(ChatI18nKeys.ClearConversationMessages)}
                  >
                    <DialGhostIconButton
                      size={ElementSize.Small}
                      onClick={() => setIsClearConversationModalOpen(true)}
                      data-qa="clear-conversation"
                      disabled={isMessageStreaming}
                      icon={<IconEraser size={DEFAULT_ICON_SIZES.SMALL} />}
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
                <DialLinkButton
                  className="px-0"
                  onClick={onCancelPlaybackMode}
                  data-qa="cancel-playback-mode"
                  label={
                    screenState === ScreenState.SM
                      ? t(ChatI18nKeys.Stop)
                      : t(ChatI18nKeys.StopPlayback)
                  }
                />
              )}

              {isCompareMode && selectedConversationIds.length > 1 && (
                <Tooltip
                  isTriggerClickable
                  tooltip={t(ChatI18nKeys.DeleteConversationFromCompare)}
                >
                  <CloseButtonSmall
                    onClick={() => onUnselectConversation(conversation.id)}
                    disabled={isMessageStreaming}
                    data-qa="delete-from-compare"
                  />
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <ConfirmDialog
          isOpen={isClearConversationModalOpen}
          heading={t(ChatI18nKeys.ConfirmDeletingAllMessages)}
          description={t(ChatI18nKeys.AreYouSureDeleteAllMessages)}
          confirmLabel={t(ChatI18nKeys.Delete)}
          cancelLabel={t(ChatI18nKeys.Cancel)}
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
