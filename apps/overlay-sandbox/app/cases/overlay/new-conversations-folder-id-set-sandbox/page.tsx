'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

// Use your bucket for testing
const bucket =
  '3s5mL6jaqKuWBohoam9sRw7jeqixBDW5QSQezNrvhvu36fKFb8FkRVrpyqx8sQzaSj';
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
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
