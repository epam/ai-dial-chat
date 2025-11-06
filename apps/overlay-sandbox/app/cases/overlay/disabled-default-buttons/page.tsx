'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.Header,
    Feature.ConversationsSection,
    Feature.HideEditUserMessage,
    Feature.HideRegenerateAssistantMessage,
    Feature.HideDeleteUserMessage,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
