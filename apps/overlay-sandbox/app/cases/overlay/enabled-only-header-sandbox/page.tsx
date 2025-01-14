'use client';

import DynamicChatOverlayWrapper, {
  commonOverlayProps,
} from '../../components/dynamicChatOverlayWrapper';

import { Feature } from '@epam/ai-dial-shared';

const overlayOptions = {
  ...commonOverlayProps,
  enabledFeatures: [Feature.Header],
};

export default function Index() {
  return <DynamicChatOverlayWrapper overlayOptions={overlayOptions} />;
}
