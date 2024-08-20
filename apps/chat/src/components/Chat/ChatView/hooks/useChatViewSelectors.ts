import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

export const useChatViewSelectors = () => {
  return {
    addons: useAppSelector(AddonsSelectors.selectAddons),
    addonsMap: useAppSelector(AddonsSelectors.selectAddonsMap),
    appName: useAppSelector(SettingsSelectors.selectAppName),
    conversations: useAppSelector(ConversationsSelectors.selectConversations),
    enabledFeatures: useAppSelector(SettingsSelectors.selectEnabledFeatures),
    isAnyMenuOpen: useAppSelector(UISelectors.selectIsAnyMenuOpen),
    isCompareMode: useAppSelector(UISelectors.selectIsCompareMode),
    isChatFullWidth: useAppSelector(UISelectors.selectIsChatFullWidth),
    isExternal: useAppSelector(
      ConversationsSelectors.selectAreSelectedConversationsExternal,
    ),
    isIsolatedView: useAppSelector(SettingsSelectors.selectIsIsolatedView),
    isModelsLoaded: useAppSelector(ModelsSelectors.selectIsModelsLoaded),
    isPlayback: useAppSelector(
      ConversationsSelectors.selectIsPlaybackSelectedConversations,
    ),
    isReplay: useAppSelector(
      ConversationsSelectors.selectIsReplaySelectedConversations,
    ),
    isReplayPaused: useAppSelector(ConversationsSelectors.selectIsReplayPaused),
    isReplayRequiresVariables: useAppSelector(
      ConversationsSelectors.selectIsReplayRequiresVariables,
    ),
    isMessageStreaming: useAppSelector(
      ConversationsSelectors.selectIsConversationsStreaming,
    ),
    modelError: useAppSelector(ModelsSelectors.selectModelsError),
    models: useAppSelector(ModelsSelectors.selectModels),
    modelsMap: useAppSelector(ModelsSelectors.selectModelsMap),
    prompts: useAppSelector(PromptsSelectors.selectPrompts),
    selectedConversations: useAppSelector(
      ConversationsSelectors.selectSelectedConversations,
    ),
    selectedConversationsIds: useAppSelector(
      ConversationsSelectors.selectSelectedConversationsIds,
    ),
  };
};
