import {
  isAudioTranscriptionSupported,
  OverlayFeature,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo, useRef } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import {
  transcribeAudio,
  transcribeAudioWithAsrModel,
} from '../../server-api/chat.api';
import { uploadFile } from '../../server-api/files.api';
import { buildUploadPath } from '../../utils/build-upload-path';
import { useUiFeature } from '../useUiFeature';

interface Params {
  bucket: string | undefined;
  transcribeSizeLimitBytes: number;
  asrModelId?: string | null;
  selectedDeploymentId?: string | null;
}

interface Result {
  handleUploadAudio: (file: File, contentType: string) => Promise<string>;
  handleTranscribeAudio: (audioUrl: string) => Promise<string>;
  isTranscriptionSupported: boolean;
}

export const useAudioTranscription = ({
  bucket,
  transcribeSizeLimitBytes,
  asrModelId,
  selectedDeploymentId,
}: Params): Result => {
  const { items } = useDeployments();
  const lastAudioMimeTypeRef = useRef<string>('audio/webm');
  const isVoiceInputEnabled = useUiFeature(OverlayFeature.VoiceInput);

  const handleUploadAudio = useCallback(
    async (file: File, contentType: string): Promise<string> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }
      if (file.size > transcribeSizeLimitBytes) {
        throw new Error(
          `Audio file exceeds the ${transcribeSizeLimitBytes} byte limit`,
        );
      }
      lastAudioMimeTypeRef.current = contentType;
      const response = await uploadFile(
        bucket,
        buildUploadPath({ name: file.name } as Attachment),
        file,
      );
      return response.url;
    },
    [bucket, transcribeSizeLimitBytes],
  );

  const handleTranscribeAudio = useCallback(
    async (audioUrl: string): Promise<string> => {
      const mimeType = lastAudioMimeTypeRef.current;
      if (asrModelId != null) {
        return transcribeAudioWithAsrModel({ audioUrl, mimeType });
      }
      if (!selectedDeploymentId) {
        throw new Error('No model selected');
      }
      return transcribeAudio({
        audioUrl,
        mimeType,
        deployment: selectedDeploymentId,
      });
    },
    [asrModelId, selectedDeploymentId],
  );

  const isTranscriptionSupported = useMemo(() => {
    if (!isVoiceInputEnabled) return false;
    if (asrModelId != null) return true;
    const selectedItem = items.find((item) => item.id === selectedDeploymentId);
    return isAudioTranscriptionSupported(selectedItem?.inputAttachmentTypes);
  }, [isVoiceInputEnabled, asrModelId, items, selectedDeploymentId]);

  return { handleUploadAudio, handleTranscribeAudio, isTranscriptionSupported };
};
