import { AttachmentType, OverlayFeature } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiFeature } from '../../useUiFeature';
import { useAudioTranscription } from '../useAudioTranscription';

const mockUseDeployments = vi.fn();

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => mockUseDeployments(),
}));
vi.mock('../../useUiFeature');

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

  it('returns false when no deployment is selected', () => {
    mockUseDeployments.mockReturnValue({
      items: [makeItem('gpt-4o', ['audio/webm'])],
    });
    const { result } = renderHook(() =>
      useAudioTranscription({ selectedDeploymentId: undefined }),
    );

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
