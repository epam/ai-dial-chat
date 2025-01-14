'use client';

import DynamicChatOverlayWrapper, {
  commonOverlayProps,
} from '../../components/dynamicChatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  modelId: 'gpt-4',
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
  ...commonOverlayProps,
};

export default function Index() {
  return <DynamicChatOverlayWrapper overlayOptions={overlayOptions} />;
}
