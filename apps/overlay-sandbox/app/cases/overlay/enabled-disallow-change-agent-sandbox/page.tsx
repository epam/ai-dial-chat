'use client';

import DynamicChatOverlayWrapper, {
  commonOverlayProps,
} from '../../components/dynamicChatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  enabledFeatures: [
    Feature.TopSettings,
    Feature.TopChatInfo,
    Feature.DisallowChangeAgent,
  ],
  ...commonOverlayProps,
};

export default function Index() {
  return <DynamicChatOverlayWrapper overlayOptions={overlayOptions} />;
}
