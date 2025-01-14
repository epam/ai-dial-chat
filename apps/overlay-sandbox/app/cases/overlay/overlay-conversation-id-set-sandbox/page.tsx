'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  overlayConversationId:
    'conversations/public/playback__[Playback] overlayConversationName__0.0.1',
  enabledFeatures: [
    Feature.ConversationsSection,
    Feature.ConversationsPublishing,
    Feature.Header,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
