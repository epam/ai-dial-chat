import {
  AudioTranscriptionError,
  AudioTranscriptionErrorReason,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceRecordingI18nKeys } from '../../../constants/translation-keys';
import { useUiFeature } from '../../useUiFeature';
import { useAudioTranscription } from '../useAudioTranscription';

const mockUseDeployments = vi.fn();
const mockUseTranscribeAudio = vi.fn();
const config = {
  asrModelId: null as string | null,
  transcribeSizeLimitBytes: 1024,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config }),
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'bucket' } }),
}));
vi.mock('../../../server-api/api-client', () => ({
  filesApi: {},
  transcriptionApi: {},
}));
vi.mock('../../../server-api/chat.api', () => ({
  transcribeAudio: vi.fn(),
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => mockUseDeployments(),
}));
vi.mock('../../useUiFeature');
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return { ...actual, useTranscribeAudio: () => mockUseTranscribeAudio() };
});

const mockUseUiFeature = vi.mocked(useUiFeature);

const makeItem = (id: string, inputAttachmentTypes?: string[]) => ({
  id,
  displayName: id,
  type: AttachmentType.File,
  inputAttachmentTypes,
});

describe('useAudioTranscription', () => {
  const transcribe = vi.fn();
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    config.asrModelId = null;
    config.transcribeSizeLimitBytes = 1024;
    mockUseDeployments.mockReturnValue({ items: [] });
    mockUseUiFeature.mockReturnValue(true);
    mockUseTranscribeAudio.mockReturnValue({ transcribeAudio: transcribe });
  });

  it('returns false when no deployment is selected', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['audio/webm'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: undefined }),
    );

    expect(result.current.isAudioMessageSupported).toBe(false);
  });

  it('resolves with the injected transcribe result', async () => {
    config.asrModelId = 'asr';
    transcribe.mockResolvedValue('Recognized text');
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: 'text-model' }),
    );
    const file = new File(['audio'], 'voice.mp4', { type: 'audio/mp4' });
    const signal = new AbortController().signal;
    expect(result.current.isAudioMessageSupported).toBe(true);
    expect(result.current.isVoiceRecordingSupported).toBe(false);
    await expect(
      result.current.handleTranscribeAudio(file, signal),
    ).resolves.toBe('Recognized text');
    expect(transcribe).toHaveBeenCalledWith(file, signal);
  });

  it('passes bucket, size limit and the deployment callback through to useTranscribeAudio', () => {
    config.asrModelId = 'asr';
    config.transcribeSizeLimitBytes = 2048;
    mockUseDeployments.mockReturnValue({
      items: [makeItem('audio-model', ['audio/webm'])],
    });
    renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: 'audio-model' }),
    );
    expect(mockUseTranscribeAudio).toHaveBeenCalled();
  });

  it('throws Unavailable before calling transcribe when the feature is unsupported', async () => {
    mockUseUiFeature.mockReturnValue(false);
    const { result } = renderHook(() => useAudioTranscription({}));
    await expect(
      result.current.handleTranscribeAudio(
        new File(['audio'], 'voice.webm'),
        new AbortController().signal,
      ),
    ).rejects.toThrow(VoiceRecordingI18nKeys.Unavailable);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('rethrows the original error when the signal was aborted', async () => {
    config.asrModelId = 'asr';
    const controller = new AbortController();
    const abortError = new Error('aborted');
    transcribe.mockImplementation(async () => {
      controller.abort();
      throw abortError;
    });
    const { result } = renderHook(() => useAudioTranscription({}));
    await expect(
      result.current.handleTranscribeAudio(
        new File(['audio'], 'voice.webm'),
        controller.signal,
      ),
    ).rejects.toBe(abortError);
  });

  it.each([
    [AudioTranscriptionErrorReason.TooLarge, VoiceRecordingI18nKeys.TooLarge],
    [AudioTranscriptionErrorReason.Busy, VoiceRecordingI18nKeys.Busy],
    [
      AudioTranscriptionErrorReason.Unavailable,
      VoiceRecordingI18nKeys.Unavailable,
    ],
    [AudioTranscriptionErrorReason.Failed, VoiceRecordingI18nKeys.Failed],
  ])(
    'translates AudioTranscriptionErrorReason.%s at the app edge',
    async (reason, expectedKey) => {
      config.asrModelId = 'asr';
      transcribe.mockRejectedValue(new AudioTranscriptionError(reason, 1024));
      const { result } = renderHook(() => useAudioTranscription({}));
      await expect(
        result.current.handleTranscribeAudio(
          new File(['audio'], 'voice.webm'),
          new AbortController().signal,
        ),
      ).rejects.toThrow(expectedKey);
    },
  );

  it('falls back to the generic Failed message for a non-library error', async () => {
    config.asrModelId = 'asr';
    transcribe.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAudioTranscription({}));
    await expect(
      result.current.handleTranscribeAudio(
        new File(['audio'], 'voice.webm'),
        new AbortController().signal,
      ),
    ).rejects.toThrow(VoiceRecordingI18nKeys.Failed);
  });

  it('keeps ASR disabled when voice-input is disabled', () => {
    config.asrModelId = 'asr';
    mockUseUiFeature.mockReturnValue(false);
    const { result } = renderHook(() => useAudioTranscription({}));
    expect(result.current.isAudioMessageSupported).toBe(false);
  });

  it('returns false when the selected deployment is not found in the list', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['audio/webm'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: 'unknown-model' }),
    );

    expect(result.current.isAudioMessageSupported).toBe(false);
  });

  it('returns true when the selected deployment supports audio input', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['audio/webm'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: 'gpt-4o' }),
    );

    expect(result.current.isAudioMessageSupported).toBe(true);
    expect(mockUseUiFeature).toHaveBeenCalledWith(OverlayFeature.VoiceInput);
  });

  it('returns false when the selected deployment has no audio input types', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['image/png'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: 'gpt-4o' }),
    );

    expect(result.current.isAudioMessageSupported).toBe(false);
  });

  it('returns false when the selected deployment has no attachment types configured', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o')],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: 'gpt-4o' }),
    );

    expect(result.current.isAudioMessageSupported).toBe(false);
  });

  it('returns false when voice-input is disabled, even when the selected deployment supports audio input', () => {
    mockUseUiFeature.mockReturnValue(false);
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['audio/webm'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: 'gpt-4o' }),
    );

    expect(result.current.isAudioMessageSupported).toBe(false);
  });
});
