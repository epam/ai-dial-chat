'use client';

import { ChatOverlayWrapper } from '../../components/chatOverlayWrapper';
import { commonOverlayProps } from '../../components/commonOverlayProps';

import {
  ChatOverlayOptions,
  Feature,
  OverlayEvents,
} from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  loaderHideEvent: OverlayEvents.readyToInteract,
  signInOptions: {
    autoSignIn: true,
    signInProvider: 'keycloak',
  },
  enabledFeatures: [
    Feature.ConversationsSection,
    Feature.PromptsSection,
    Feature.TopSettings,
    Feature.TopClearConversation,
    Feature.TopChatInfo,
    Feature.TopChatModelSettings,
    Feature.EmptyChatSettings,
    Feature.Header,
    Feature.Footer,
    Feature.RequestApiKey,
    Feature.ReportAnIssue,
    Feature.Likes,
    Feature.Marketplace,
  ],
} as ChatOverlayOptions;

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}
