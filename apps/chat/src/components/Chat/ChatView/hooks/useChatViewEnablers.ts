import { useMemo } from 'react';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { ErrorMessage } from '@/src/types/error';

import { Feature } from '@epam/ai-dial-shared';

interface UseChatViewEnablersProps {
  enabledFeatures: Set<Feature>;
  isAnyMenuOpen: boolean;
  isCompareMode: boolean;
  isExternal: boolean;
  isIsolatedView: boolean;
  isLastMessageError: boolean;
  isMessageStreaming: boolean;
  isPlayback: boolean;
  isReplay: boolean;
  modelError: ErrorMessage | undefined;
  notAllowedType: EntityType | null;
  selectedConversations: Conversation[];
}

export const useChatViewEnablers = ({
  enabledFeatures,
  isAnyMenuOpen,
  isCompareMode,
  isExternal,
  isIsolatedView,
  isPlayback,
  isReplay,
  isMessageStreaming,
  modelError,
  notAllowedType,
  selectedConversations,
  isLastMessageError,
}: UseChatViewEnablersProps) => {
  const showFloatingOverlay =
    isSmallScreen() && isAnyMenuOpen && !isIsolatedView;
  const showChatSection = !modelError;
  const showErrorMessage = modelError;

  const isLikesEnabled = useMemo(
    () => enabledFeatures.has(Feature.Likes),
    [enabledFeatures],
  );
  const showPlaybackControls = useMemo(() => isPlayback, [isPlayback]);
  const showTopChatInfo = useMemo(
    () => enabledFeatures.has(Feature.TopChatInfo),
    [enabledFeatures],
  );
  const showEmptyChatSettings = useMemo(
    () => enabledFeatures.has(Feature.EmptyChatSettings),
    [enabledFeatures],
  );
  const showTopSettings = useMemo(
    () => enabledFeatures.has(Feature.TopSettings),
    [enabledFeatures],
  );
  const showChatControls = useMemo(
    () => isPlayback || !notAllowedType,
    [isPlayback, notAllowedType],
  );
  const showLastMessageRegenerate = useMemo(
    () =>
      !isReplay &&
      !isPlayback &&
      !isExternal &&
      !isMessageStreaming &&
      !isLastMessageError,
    [isReplay, isPlayback, isExternal, isMessageStreaming, isLastMessageError],
  );
  const showNotAllowedModel = useMemo(
    () => !isPlayback && notAllowedType,
    [isPlayback, notAllowedType],
  );
  const showModelSelect = useMemo(
    () =>
      enabledFeatures.has(Feature.TopChatModelSettings) &&
      !isPlayback &&
      !isExternal,
    [enabledFeatures, isPlayback, isExternal],
  );
  const showClearConversations = useMemo(
    () =>
      enabledFeatures.has(Feature.TopClearConversation) &&
      !isPlayback &&
      !isReplay &&
      !isMessageStreaming &&
      !isExternal,
    [enabledFeatures, isExternal, isPlayback, isReplay, isMessageStreaming],
  );
  const showCompareChatSection = useMemo(
    () => isCompareMode && selectedConversations.length < 2,
    [isCompareMode, selectedConversations.length],
  );

  return {
    isLikesEnabled,
    showChatControls,
    showChatSection,
    showClearConversations,
    showCompareChatSection,
    showEmptyChatSettings,
    showErrorMessage,
    showFloatingOverlay,
    showLastMessageRegenerate,
    showModelSelect,
    showNotAllowedModel,
    showPlaybackControls,
    showTopChatInfo,
    showTopSettings,
  };
};
