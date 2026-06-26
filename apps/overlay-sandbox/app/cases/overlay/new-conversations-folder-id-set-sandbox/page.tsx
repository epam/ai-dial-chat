'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

import { Feature } from '@epam/ai-dial-shared';

// Use your bucket for testing
const bucket = process.env.NEXT_PUBLIC_OVERLAY_USER_BUCKET;
const overlayOptions = {
  ...commonOverlayProps,
  newConversationsFolderId: `conversations/${bucket}/test-folder`,
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
    Feature.LiveChatInteraction,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
