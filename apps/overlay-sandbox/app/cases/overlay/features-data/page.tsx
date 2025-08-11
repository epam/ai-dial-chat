'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { Feature, FeatureData } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.Header,
    Feature.ConversationsSection,
    {
      name: Feature.DisabledSend,
      description: 'This is tooltip for disabled send',
    },
    {
      name: Feature.DisabledPlaybackControls,
      description: 'This is tooltip for disabled playback controls',
    },
  ] as (Feature | FeatureData)[],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
