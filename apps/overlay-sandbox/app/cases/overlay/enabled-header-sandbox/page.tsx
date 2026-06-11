'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.Header,
    Feature.Footer,
    Feature.ConversationsSection,
    Feature.PromptsSection,
    Feature.TopSettings,
    Feature.TopClearConversation,
    Feature.TopChatInfo,
    Feature.TopChatModelSettings,
    Feature.EmptyChatSettings,
    Feature.RequestApiKey,
    Feature.ReportAnIssue,
    Feature.Likes,
    Feature.Marketplace,
    Feature.HideNewConversation,
    Feature.ConversationsSharing,
    Feature.PromptsSharing,
    Feature.AttachmentsManager,
    Feature.ConversationsPublishing,
    Feature.PromptsPublishing,
    Feature.CustomLogo,
    Feature.MessageTemplates,
    Feature.ShowConversationsSectionByDefault,
    Feature.ShowPromptsSectionByDefault,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
