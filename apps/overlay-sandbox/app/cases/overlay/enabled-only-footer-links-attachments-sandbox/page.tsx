'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.ReportAnIssue,
    Feature.RequestApiKey,
    Feature.AttachmentsManager,
  ],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
