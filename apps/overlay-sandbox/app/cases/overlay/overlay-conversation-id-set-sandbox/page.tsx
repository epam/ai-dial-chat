'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST!,
  overlayConversationId:
    'conversations/public/playback__[Playback] overlayConversationName__0.0.1',
  enabledFeatures: [
    Feature.ConversationsSection,
    Feature.ConversationsPublishing,
    Feature.Header,
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
