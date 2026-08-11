import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { isAudioTranscriptionSupported } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import { findDeploymentByIdOrReference } from '../../utils/deployment-id';
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
    const selectedItem = findDeploymentByIdOrReference(
      items,
      selectedDeploymentId,
    );
    return isAudioTranscriptionSupported(selectedItem?.inputAttachmentTypes);
  }, [isVoiceInputEnabled, items, selectedDeploymentId]);

  return { isAudioMessageSupported };
};
