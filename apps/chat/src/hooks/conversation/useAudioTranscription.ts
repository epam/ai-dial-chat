import { isAudioTranscriptionSupported } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';

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

  const isAudioMessageSupported = useMemo(() => {
    const selectedItem = items.find((item) => item.id === selectedDeploymentId);
    return isAudioTranscriptionSupported(selectedItem?.inputAttachmentTypes);
  }, [items, selectedDeploymentId]);

  return { isAudioMessageSupported };
};
