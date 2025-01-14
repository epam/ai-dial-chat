'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST!,
  enabledFeatures: [
    Feature.ReportAnIssue,
    Feature.RequestApiKey,
    Feature.AttachmentsManager,
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
