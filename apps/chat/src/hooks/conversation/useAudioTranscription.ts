import {
  AudioTranscriptionError,
  AudioTranscriptionErrorReason,
  findDeploymentByIdOrReference,
  useTranscribeAudio,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { isAudioTranscriptionSupported } from '@epam/ai-dial-chat-shared';
import type { TranscribeAudio } from '@epam/ai-dial-conversation-input';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VoiceRecordingI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { filesApi, transcriptionApi } from '../../server-api/api-client';
import { transcribeAudio } from '../../server-api/chat.api';
import { useUiFeature } from '../useUiFeature';

interface Params {
  selectedDeploymentId?: string | null;
}

interface Result {
  isAudioMessageSupported: boolean;
  isVoiceRecordingSupported: boolean;
  handleTranscribeAudio: TranscribeAudio;
}

/** Keeps storage and speech-provider routing at the app edge for every composer. */
export const useAudioTranscription = ({
  selectedDeploymentId,
}: Params): Result => {
  const { items } = useDeployments();
  const { user } = useUser();
  const bucket = user?.bucket;
  const {
    config: { asrModelId, transcribeSizeLimitBytes },
  } = useAppConfig();
  const { t } = useTranslation();
  const isVoiceInputEnabled = useUiFeature(OverlayFeature.VoiceInput);

  const isVoiceRecordingSupported = useMemo(() => {
    if (!isVoiceInputEnabled) return false;
    const selectedItem = findDeploymentByIdOrReference(
      items,
      selectedDeploymentId,
    );
    return isAudioTranscriptionSupported(selectedItem?.inputAttachmentTypes);
  }, [isVoiceInputEnabled, items, selectedDeploymentId]);
  const isAudioMessageSupported =
    isVoiceInputEnabled && (Boolean(asrModelId) || isVoiceRecordingSupported);

  const { transcribeAudio: transcribe } = useTranscribeAudio({
    transcriptionApi,
    filesApi,
    transcribeWithDeployment: transcribeAudio,
    bucket,
    asrModelId: isAudioMessageSupported ? (asrModelId ?? undefined) : undefined,
    selectedDeploymentId,
    maxSizeBytes: transcribeSizeLimitBytes,
  });

  const handleTranscribeAudio = useCallback(
    async (file: File, signal: AbortSignal) => {
      if (!isAudioMessageSupported) {
        throw new Error(t(VoiceRecordingI18nKeys.Unavailable));
      }
      try {
        return await transcribe(file, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof AudioTranscriptionError) {
          switch (error.reason) {
            case AudioTranscriptionErrorReason.TooLarge:
              throw new Error(
                t(VoiceRecordingI18nKeys.TooLarge, {
                  limit: error.limitBytes,
                }),
              );
            case AudioTranscriptionErrorReason.Busy:
              throw new Error(t(VoiceRecordingI18nKeys.Busy));
            case AudioTranscriptionErrorReason.Unavailable:
              throw new Error(t(VoiceRecordingI18nKeys.Unavailable));
            default:
              throw new Error(t(VoiceRecordingI18nKeys.Failed));
          }
        }
        throw new Error(t(VoiceRecordingI18nKeys.Failed));
      }
    },
    [isAudioMessageSupported, transcribe, t],
  );

  return {
    isAudioMessageSupported,
    isVoiceRecordingSupported,
    handleTranscribeAudio,
  };
};
