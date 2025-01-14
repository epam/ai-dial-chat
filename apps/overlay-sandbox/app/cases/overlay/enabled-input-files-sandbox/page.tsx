'use client';

import DynamicChatOverlayWrapper, {
  commonOverlayProps,
} from '../../components/dynamicChatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  enabledFeatures: [
    Feature.EmptyChatSettings,
    Feature.Header,
    Feature.ConversationsSection,
    Feature.InputFiles,
  ],
  ...commonOverlayProps,
};

export default function Index() {
  return <DynamicChatOverlayWrapper overlayOptions={overlayOptions} />;
}
