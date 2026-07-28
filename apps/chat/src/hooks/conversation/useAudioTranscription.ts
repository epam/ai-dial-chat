import {
  isAudioTranscriptionSupported,
  OverlayFeature,
} from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import { useUiFeature } from '../useUiFeature';

interface Params {
  selectedDeploymentId?: string | null;
}

interface Result {
  isAudioMessageSupported: boolean;
}

export const useAudioTranscription = ({
  selectedDeploymentId,
}: Params): Result => {
  const { items } = useDeployments();
  const isVoiceInputEnabled = useUiFeature(OverlayFeature.VoiceInput);

  const isAudioMessageSupported = useMemo(() => {
    if (!isVoiceInputEnabled) return false;
    const selectedItem = items.find((item) => item.id === selectedDeploymentId);
    return isAudioTranscriptionSupported(selectedItem?.inputAttachmentTypes);
  }, [isVoiceInputEnabled, items, selectedDeploymentId]);

  return { isAudioMessageSupported };
};
