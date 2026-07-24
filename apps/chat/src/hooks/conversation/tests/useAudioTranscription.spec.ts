import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  transcribeAudio,
  transcribeAudioWithAsrModel,
} from '../../../server-api/chat.api';
import { uploadFile } from '../../../server-api/files.api';
import { useUiFeature } from '../../useUiFeature';
import { useAudioTranscription } from '../useAudioTranscription';

const mockUseDeployments = vi.fn();

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => mockUseDeployments(),
}));
vi.mock('../../../server-api/files.api', () => ({
  uploadFile: vi.fn(),
}));
vi.mock('../../../server-api/chat.api', () => ({
  transcribeAudio: vi.fn(),
  transcribeAudioWithAsrModel: vi.fn(),
}));
vi.mock('../../../utils/build-upload-path', () => ({
  buildUploadPath: vi.fn(
    (attachment: { name: string }) => `uploads/${attachment.name}`,
  ),
}));
vi.mock('../../useUiFeature');

const mockUploadFile = vi.mocked(uploadFile);
const mockTranscribeAudio = vi.mocked(transcribeAudio);
const mockTranscribeAudioWithAsrModel = vi.mocked(transcribeAudioWithAsrModel);
const mockUseUiFeature = vi.mocked(useUiFeature);

const makeItem = (id: string, inputAttachmentTypes?: string[]) => ({
  id,
  displayName: id,
  type: AttachmentType.File,
  inputAttachmentTypes,
});

describe('useAudioTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeployments.mockReturnValue({ items: [] });
    mockUseUiFeature.mockReturnValue(true);
  });

  it('uploads audio within the size limit', async () => {
    mockUploadFile.mockResolvedValue({ url: 'https://example.com/audio.webm' });
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1000,
      }),
    );

    const file = new File(['a'], 'audio.webm', { type: 'audio/webm' });
    await expect(
      result.current.handleUploadAudio(file, 'audio/webm'),
    ).resolves.toBe('https://example.com/audio.webm');
    expect(mockUploadFile).toHaveBeenCalledWith(
      'user-bucket',
      'uploads/audio.webm',
      file,
    );
  });

  it('rejects audio exceeding the size limit without uploading', async () => {
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1,
      }),
    );

    const file = new File(['too-large'], 'audio.webm', { type: 'audio/webm' });
    await expect(
      result.current.handleUploadAudio(file, 'audio/webm'),
    ).rejects.toThrow(/exceeds the 1 byte limit/);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('transcribes via the deployment when no ASR model is configured', async () => {
    mockTranscribeAudio.mockResolvedValue('hello world');
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1000,
        selectedDeploymentId: 'gpt-4o',
      }),
    );

    await expect(
      result.current.handleTranscribeAudio('https://example.com/audio.webm'),
    ).resolves.toBe('hello world');
    expect(mockTranscribeAudio).toHaveBeenCalledWith({
      audioUrl: 'https://example.com/audio.webm',
      mimeType: 'audio/webm',
      deployment: 'gpt-4o',
    });
    expect(mockTranscribeAudioWithAsrModel).not.toHaveBeenCalled();
  });

  it('transcribes via the ASR model when configured', async () => {
    mockTranscribeAudioWithAsrModel.mockResolvedValue('hi there');
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1000,
        asrModelId: 'asr-model',
        selectedDeploymentId: 'gpt-4o',
      }),
    );

    await expect(
      result.current.handleTranscribeAudio('https://example.com/audio.webm'),
    ).resolves.toBe('hi there');
    expect(mockTranscribeAudioWithAsrModel).toHaveBeenCalledWith({
      audioUrl: 'https://example.com/audio.webm',
      mimeType: 'audio/webm',
    });
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });

  it('reports transcription supported when an ASR model is configured, regardless of deployment', () => {
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1000,
        asrModelId: 'asr-model',
        selectedDeploymentId: undefined,
      }),
    );

    expect(result.current.isTranscriptionSupported).toBe(true);
  });

  it('reports transcription supported based on the selected deployment capability', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['audio/webm'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1000,
        selectedDeploymentId: 'gpt-4o',
      }),
    );

    expect(result.current.isTranscriptionSupported).toBe(true);
  });

  it('reports transcription unsupported when the deployment lacks audio input support', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['image/png'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1000,
        selectedDeploymentId: 'gpt-4o',
      }),
    );

    expect(result.current.isTranscriptionSupported).toBe(false);
  });

  it('reports transcription unsupported when voice-input is disabled, even with an ASR model configured', () => {
    mockUseUiFeature.mockReturnValue(false);
    const { result } = renderHook(() =>
      useAudioTranscription({
        bucket: 'user-bucket',
        transcribeSizeLimitBytes: 1000,
        asrModelId: 'asr-model',
        selectedDeploymentId: undefined,
      }),
    );

    expect(result.current.isTranscriptionSupported).toBe(false);
  });
});
