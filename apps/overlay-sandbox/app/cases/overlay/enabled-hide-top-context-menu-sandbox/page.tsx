'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.TopSettings,
    Feature.ConversationsSection,
    Feature.HideTopContextMenu,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
