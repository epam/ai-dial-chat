'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST!,
  theme: 'light',
  modelId: 'gpt-4',
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
  requestTimeout: 20000,
  loaderStyles: {
    background: 'white',
    fontSize: '24px',
  },
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
