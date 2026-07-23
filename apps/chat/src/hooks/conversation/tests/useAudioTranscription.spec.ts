import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioTranscription } from '../useAudioTranscription';

const mockUseDeployments = vi.fn();

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => mockUseDeployments(),
}));

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
});
