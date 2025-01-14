'use client';

import DynamicChatOverlayWrapper, {
  commonOverlayProps,
} from '../../components/dynamicChatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  theme: 'light',
  enabledFeatures: [
    Feature.ConversationsSection,
    Feature.PromptsSection,
    Feature.TopSettings,
    Feature.TopClearConversation,
    Feature.TopChatInfo,
    Feature.TopChatModelSettings,
    Feature.EmptyChatSettings,
    Feature.RequestApiKey,
    Feature.ReportAnIssue,
    Feature.Likes,
    Feature.Marketplace,
    Feature.HideNewConversation,
    Feature.ConversationsSharing,
    Feature.PromptsSharing,
    Feature.AttachmentsManager,
    Feature.ConversationsPublishing,
    Feature.PromptsPublishing,
    Feature.CustomLogo,
    Feature.Footer,
  ],
};

export default function Index() {
  return <DynamicChatOverlayWrapper overlayOptions={overlayOptions} />;
}
