import type { FilesApi, TranscriptionApi } from '@epam/ai-dial-chat-api-client';
import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioTranscriptionErrorReason } from '../audio-transcription-error';
import {
  useTranscribeAudio,
  UploadMimeTypePolicy,
} from '../useTranscribeAudio';

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

  it('uses the ASR model and sends the audio MIME type without codec parameters', async () => {
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
    const file = new File(['audio'], 'voice.mp4', {
      type: 'audio/mp4;codecs=mp4a.40.2',
    });
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
        new File(['audio'], 'voice.webm', { type: 'audio/webm;codecs=opus' }),
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

  it.each(Object.values(UploadMimeTypePolicy))(
    'retries ASR recognition using one upload with %s',
    async (uploadMimeTypePolicy) => {
      vi.useFakeTimers();
      transcribeAudio
        .mockRejectedValueOnce(
          new ResponseError(new Response(null, { status: 502 })),
        )
        .mockResolvedValue({ transcript: 'Recovered' });
      const { result } = renderHook(() =>
        useTranscribeAudio({
          filesApi: fakeFilesApi,
          transcriptionApi: fakeTranscriptionApi,
          bucket: 'bucket',
          asrModelId: 'asr',
          maxSizeBytes: 1024,
          uploadMimeTypePolicy,
        }),
      );
      const pending = result.current.transcribeAudio(
        new File(['audio'], 'voice.webm', { type: 'audio/webm;codecs=opus' }),
        new AbortController().signal,
      );
      await vi.advanceTimersByTimeAsync(2000);
      await expect(pending).resolves.toBe('Recovered');
      expect(uploadFile).toHaveBeenCalledOnce();
      expect(transcribeAudio).toHaveBeenCalledTimes(2);
    },
  );

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

it.each([
  undefined,
  UploadMimeTypePolicy.Preserve,
  UploadMimeTypePolicy.Normalize,
])(
  'preserves bytes and metadata under upload policy %s',
  async (uploadMimeTypePolicy) => {
    uploadFile.mockResolvedValue({ url: 'file' });
    transcribeAudio.mockResolvedValue({ transcript: 'ok' });
    const file = new File(['audio bytes'], 'recording.webm', {
      type: 'audio/webm;codecs=opus',
      lastModified: 123,
    });
    const { result } = renderHook(() =>
      useTranscribeAudio({
        filesApi: fakeFilesApi,
        transcriptionApi: fakeTranscriptionApi,
        bucket: 'b',
        asrModelId: 'asr',
        maxSizeBytes: 1000,
        uploadMimeTypePolicy,
      }),
    );
    await result.current.transcribeAudio(file, new AbortController().signal);
    const uploaded = uploadFile.mock.calls[uploadFile.mock.calls.length - 1][0]
      .file as File;
    expect(uploaded.type).toBe(
      uploadMimeTypePolicy === UploadMimeTypePolicy.Normalize
        ? 'audio/webm'
        : file.type,
    );
    expect(uploaded.name).toBe(file.name);
    expect(uploaded.lastModified).toBe(123);
    expect(uploaded.size).toBe(file.size);
    const read = (blob: Blob) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(blob);
      });
    expect(await read(uploaded)).toBe('audio bytes');
    if (uploadMimeTypePolicy !== UploadMimeTypePolicy.Normalize)
      expect(uploaded).toBe(file);
  },
);
it('does not reconstruct an already normalized upload', async () => {
  const file = new File(['a'], 'a.webm', { type: 'audio/webm' });
  const { result } = renderHook(() =>
    useTranscribeAudio({
      filesApi: fakeFilesApi,
      transcriptionApi: fakeTranscriptionApi,
      bucket: 'b',
      asrModelId: 'asr',
      maxSizeBytes: 1000,
      uploadMimeTypePolicy: UploadMimeTypePolicy.Normalize,
    }),
  );
  await result.current.transcribeAudio(file, new AbortController().signal);
  expect(uploadFile.mock.calls[uploadFile.mock.calls.length - 1][0].file).toBe(
    file,
  );
});
