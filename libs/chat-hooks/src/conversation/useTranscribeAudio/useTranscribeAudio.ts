import type { FilesApi, TranscriptionApi } from '@epam/ai-dial-chat-api-client';
import { normalizeMimeType } from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import {
  AudioTranscriptionError,
  AudioTranscriptionErrorReason,
} from './audio-transcription-error';
import { withTranscriptionRetry } from './transcription-retry';

/** Request shape the host's selected-deployment recognition call accepts. */
export interface TranscribeWithDeploymentParams {
  audioUrl: string;
  mimeType: string;
  deployment: string;
  signal: AbortSignal;
}

/** Upload file MIME policy. */
export enum UploadMimeTypePolicy {
  Preserve = 'preserve',
  Normalize = 'normalize',
}

/** Parameters for {@link useTranscribeAudio}. */
export interface UseTranscribeAudioParams {
  /** File upload MIME policy; defaults to preserve. */
  uploadMimeTypePolicy?: UploadMimeTypePolicy;
  /** Already-configured generated-client instance used for the ASR-model path. */
  transcriptionApi?: Pick<TranscriptionApi, 'transcribeAudio'>;
  /** Already-configured generated-client instance used to upload the recording. */
  filesApi: Pick<FilesApi, 'uploadFile'>;
  /**
   * Host-configured call for the selected-deployment path. The generated
   * chat-completions client cannot express this endpoint's `custom_content`
   * request shape, so the host supplies its own raw request.
   */
  transcribeWithDeployment?: (
    params: TranscribeWithDeploymentParams,
  ) => Promise<string>;
  /** DIAL Core bucket the recording is uploaded into. */
  bucket: string | undefined | null;
  /** Recognizes via `transcriptionApi` when set; otherwise `selectedDeploymentId` is used. */
  asrModelId?: string;
  /** Deployment id used for recognition when `asrModelId` is not set. */
  selectedDeploymentId?: string | null;
  /** Recordings larger than this are rejected with `TooLarge` before upload. */
  maxSizeBytes: number;
}

/** Return value of {@link useTranscribeAudio}. */
export interface UseTranscribeAudioResult {
  /** Uploads and recognizes one complete recording; rejects with an {@link AudioTranscriptionError}. */
  transcribeAudio: (file: File, signal: AbortSignal) => Promise<string>;
}

/**
 * Uploads a complete voice recording to DIAL Core storage and recognizes it,
 * preferring the configured ASR model and falling back to the selected
 * deployment. Retries transient upstream failures. Error text is not this
 * library's concern — callers translate `AudioTranscriptionErrorReason` at
 * the call site.
 */
export const useTranscribeAudio = ({
  transcriptionApi,
  filesApi,
  transcribeWithDeployment,
  bucket,
  asrModelId,
  selectedDeploymentId,
  maxSizeBytes,
  uploadMimeTypePolicy = UploadMimeTypePolicy.Preserve,
}: UseTranscribeAudioParams): UseTranscribeAudioResult => {
  const transcribeAudio = useCallback(
    async (file: File, signal: AbortSignal): Promise<string> => {
      signal.throwIfAborted();
      if (!bucket || (!asrModelId && !selectedDeploymentId)) {
        throw new AudioTranscriptionError(
          AudioTranscriptionErrorReason.Unavailable,
        );
      }
      if (file.size > maxSizeBytes) {
        throw new AudioTranscriptionError(
          AudioTranscriptionErrorReason.TooLarge,
          maxSizeBytes,
        );
      }
      try {
        const normalizedType = normalizeMimeType(file.type);
        const upload =
          uploadMimeTypePolicy === UploadMimeTypePolicy.Normalize &&
          file.type !== normalizedType
            ? new File([file], file.name, {
                type: normalizedType,
                lastModified: file.lastModified,
              })
            : file;
        const path = `uploads/${new Date().toISOString().slice(0, 7)}/${encodeURIComponent(file.name)}`;
        const { url } = await filesApi.uploadFile(
          { bucket, path, file: upload },
          { signal },
        );
        signal.throwIfAborted();
        /* MediaRecorder reports codec parameters (`audio/webm;codecs=opus`),
         * and DIAL Core rejects them against a deployment's `audio/*` filter,
         * so send the base MIME type. */
        const mimeType = normalizeMimeType(file.type);
        if (asrModelId) {
          if (!transcriptionApi) {
            throw new AudioTranscriptionError(
              AudioTranscriptionErrorReason.Unavailable,
            );
          }
          return await withTranscriptionRetry(async () => {
            const response = await transcriptionApi.transcribeAudio(
              { transcribeAudioDto: { audioUrl: url, mimeType } },
              { signal },
            );
            return response.transcript ?? '';
          }, signal);
        }
        if (!selectedDeploymentId || !transcribeWithDeployment) {
          throw new AudioTranscriptionError(
            AudioTranscriptionErrorReason.Unavailable,
          );
        }
        return await withTranscriptionRetry(
          () =>
            transcribeWithDeployment({
              audioUrl: url,
              mimeType,
              deployment: selectedDeploymentId,
              signal,
            }),
          signal,
        );
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof AudioTranscriptionError) throw error;
        throw new AudioTranscriptionError(AudioTranscriptionErrorReason.Failed);
      }
    },
    [
      bucket,
      asrModelId,
      selectedDeploymentId,
      maxSizeBytes,
      uploadMimeTypePolicy,
      filesApi,
      transcriptionApi,
      transcribeWithDeployment,
    ],
  );

  return { transcribeAudio };
};
