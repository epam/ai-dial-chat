import type { FilesApi, TranscriptionApi } from '@epam/ai-dial-chat-api-client';
import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioTranscriptionErrorReason } from '../audio-transcription-error';
import { useTranscribeAudio } from '../useTranscribeAudio';

const uploadFile = vi.fn();
const transcribeAudio = vi.fn();
const fakeFilesApi = { uploadFile } as unknown as Pick<FilesApi, 'uploadFile'>;
const fakeTranscriptionApi = {
  transcribeAudio,
} as unknown as Pick<TranscriptionApi, 'transcribeAudio'>;

describe('useTranscribeAudio', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFile.mockResolvedValue({ url: 'files/bucket/audio.webm' });
  });

  it('rejects with Unavailable when no bucket is set', async () => {
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        bucket: undefined,
        asrModelId: 'asr',
        maxSizeBytes: 1024,
      }),
    );
    await expect(
      result.current.transcribeAudio(
        new File(['audio'], 'voice.webm'),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      reason: AudioTranscriptionErrorReason.Unavailable,
    });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('rejects with Unavailable when neither an ASR model nor a deployment is set', async () => {
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        bucket: 'bucket',
        maxSizeBytes: 1024,
      }),
    );
    await expect(
      result.current.transcribeAudio(
        new File(['audio'], 'voice.webm'),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      reason: AudioTranscriptionErrorReason.Unavailable,
    });
  });

  it('rejects oversize audio with TooLarge before upload', async () => {
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        bucket: 'bucket',
        asrModelId: 'asr',
        maxSizeBytes: 1,
      }),
    );
    await expect(
      result.current.transcribeAudio(
        new File(['audio'], 'voice.webm'),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      reason: AudioTranscriptionErrorReason.TooLarge,
      limitBytes: 1,
    });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('uses the ASR model and preserves the audio MIME type', async () => {
    transcribeAudio.mockResolvedValue({ transcript: 'Recognized text' });
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        transcriptionApi: fakeTranscriptionApi,
        bucket: 'bucket',
        asrModelId: 'asr',
        maxSizeBytes: 1024,
      }),
    );
    const file = new File(['audio'], 'voice.mp4', { type: 'audio/mp4' });
    const signal = new AbortController().signal;
    await expect(result.current.transcribeAudio(file, signal)).resolves.toBe(
      'Recognized text',
    );
    expect(transcribeAudio).toHaveBeenCalledWith(
      {
        transcribeAudioDto: {
          audioUrl: 'files/bucket/audio.webm',
          mimeType: 'audio/mp4',
        },
      },
      { signal },
    );
  });

  it('uses the selected deployment when no ASR model is set', async () => {
    const transcribeWithDeployment = vi
      .fn()
      .mockResolvedValue('From deployment');
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        transcribeWithDeployment,
        bucket: 'bucket',
        selectedDeploymentId: 'audio-model',
        maxSizeBytes: 1024,
      }),
    );
    const signal = new AbortController().signal;
    await expect(
      result.current.transcribeAudio(
        new File(['audio'], 'voice.webm', { type: 'audio/webm' }),
        signal,
      ),
    ).resolves.toBe('From deployment');
    expect(transcribeWithDeployment).toHaveBeenCalledWith({
      audioUrl: 'files/bucket/audio.webm',
      mimeType: 'audio/webm',
      deployment: 'audio-model',
      signal,
    });
  });

  it('retries ASR recognition using the same uploaded file', async () => {
    vi.useFakeTimers();
    transcribeAudio
      .mockRejectedValueOnce(
        new ResponseError(new Response(null, { status: 503 })),
      )
      .mockResolvedValue({ transcript: 'Recovered' });
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        transcriptionApi: fakeTranscriptionApi,
        bucket: 'bucket',
        asrModelId: 'asr',
        maxSizeBytes: 1024,
      }),
    );
    const pending = result.current.transcribeAudio(
      new File(['audio'], 'voice.webm', { type: 'audio/webm' }),
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(pending).resolves.toBe('Recovered');
    expect(uploadFile).toHaveBeenCalledOnce();
    expect(transcribeAudio).toHaveBeenCalledTimes(2);
  });

  it('does not start recognition when cancelled during upload', async () => {
    const controller = new AbortController();
    uploadFile.mockImplementation(async () => {
      controller.abort();
      return { url: 'files/bucket/audio.webm' };
    });
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        transcriptionApi: fakeTranscriptionApi,
        bucket: 'bucket',
        asrModelId: 'asr',
        maxSizeBytes: 1024,
      }),
    );
    await expect(
      result.current.transcribeAudio(
        new File(['audio'], 'voice.webm'),
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it('wraps a generic recognition failure as Failed', async () => {
    transcribeAudio.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        transcriptionApi: fakeTranscriptionApi,
        bucket: 'bucket',
        asrModelId: 'asr',
        maxSizeBytes: 1024,
      }),
    );
    await expect(
      result.current.transcribeAudio(
        new File(['audio'], 'voice.webm'),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ reason: AudioTranscriptionErrorReason.Failed });
  });
});
