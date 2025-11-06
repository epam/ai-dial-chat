'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

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
