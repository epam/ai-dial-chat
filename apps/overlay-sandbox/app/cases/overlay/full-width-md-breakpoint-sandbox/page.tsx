'use client';

import { ChatOverlayFullWidthWrapper } from '../../components/chatOverlayFullWidthWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [
    Feature.Header,
    Feature.ConversationsSection,
    Feature.PromptsSection,
    Feature.MdSidebarOverlayBreakpoint,
  ],
};

export default function Index() {
  return <ChatOverlayFullWidthWrapper overlayOptions={overlayOptions} />;
}
