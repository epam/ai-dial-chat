import { ChatOverlayManagerWrapper } from '../components/chatOverlayManagerWrapper';
import { commonOverlayProps } from '../components/commonOverlayProps';

import { ChatOverlayManagerOptions, Feature } from '@epam/ai-dial-overlay';

const overlayOptions: Omit<ChatOverlayManagerOptions, 'hostDomain'> = {
  id: 'default-breakpoint-test',
  ...commonOverlayProps,
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST ?? '',
  theme: 'light',
  enabledFeatures: [
    Feature.Header,
    Feature.ConversationsSection,
    Feature.PromptsSection,
  ],
  allowFullscreen: true,
};

export default function Index() {
  return <ChatOverlayManagerWrapper overlayManagerOptions={overlayOptions} />;
}
