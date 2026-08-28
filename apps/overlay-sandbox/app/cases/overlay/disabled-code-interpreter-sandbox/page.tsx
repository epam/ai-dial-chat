'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.Marketplace,
    Feature.CodeApps,
    Feature.CustomApplications,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
