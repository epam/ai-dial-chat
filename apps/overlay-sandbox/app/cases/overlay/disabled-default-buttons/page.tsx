'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

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
