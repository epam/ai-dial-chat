'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

import { ChatOverlayOptions, Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.ConversationsSection,
    Feature.PromptsSection,
    Feature.TopSettings,
    Feature.TopClearConversation,
    Feature.TopChatInfo,
    Feature.TopChatModelSettings,
    Feature.EmptyChatSettings,
    Feature.Header,
    Feature.Footer,
    Feature.RequestApiKey,
    Feature.ReportAnIssue,
    Feature.Likes,
    Feature.Marketplace,
    Feature.SkipFocusChatInputOnLoad,
  ],
} as ChatOverlayOptions;

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
