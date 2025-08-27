'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.TopClearConversation,
    Feature.TopChatInfo,
    Feature.TopChatModelSettings,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
