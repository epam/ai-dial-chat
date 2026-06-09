'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.Header,
    Feature.ConversationsSection,
    Feature.DisabledPlaybackControls,
    Feature.DisabledSend,
  ],
  enabledFeaturesData: {
    [Feature.DisabledSend]: {
      description: 'This is tooltip for disabled send',
    },
    [Feature.DisabledPlaybackControls]: {
      description: 'This is tooltip for disabled playback controls',
    },
  },
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
