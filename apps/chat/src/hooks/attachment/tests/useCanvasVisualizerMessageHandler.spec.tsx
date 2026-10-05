import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import {
  useVisualizerMessage,
  VisualizerMessageProvider,
} from '../../../context/VisualizerMessageContext';
import { useCanvasVisualizerMessageHandler } from '../useCanvasVisualizerMessageHandler';

const canvas = vi.hoisted(() => ({ content: {} as object }));

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  useAttachmentCanvas: () => canvas,
}));
vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);

const wrapper = ({ children }: { children: ReactNode }) => (
  <VisualizerMessageProvider>{children}</VisualizerMessageProvider>
);

const renderHandler = () =>
  renderHook(
    () => ({
      handler: useCanvasVisualizerMessageHandler(),
      bridge: useVisualizerMessage(),
    }),
    { wrapper },
  );

describe('useCanvasVisualizerMessageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canvas.content = {};
    mockUseFeatureFlag.mockImplementation(
      (key?: string) => key === 'visualizerSendMessages',
    );
  });

  it('returns no handler while the flag is off', () => {
    mockUseFeatureFlag.mockReturnValue(false);

    const { result } = renderHandler();

    expect(result.current.handler).toBeUndefined();
  });

  it('sends into the conversation that was active when the canvas content opened', () => {
    const send = vi.fn();
    const { result, rerender } = renderHandler();
    result.current.bridge.registerSender({ conversationId: 'conv-a', send });

    canvas.content = { type: 'visualizer' };
    rerender();
    result.current.handler?.('Zoom in');

    expect(send).toHaveBeenCalledWith('Zoom in');
  });

  it('drops a message from content opened in another conversation', () => {
    const sendA = vi.fn();
    const sendB = vi.fn();
    const { result, rerender } = renderHandler();
    result.current.bridge.registerSender({
      conversationId: 'conv-a',
      send: sendA,
    });
    canvas.content = { type: 'visualizer' };
    rerender();

    result.current.bridge.registerSender({
      conversationId: 'conv-b',
      send: sendB,
    });
    rerender();
    result.current.handler?.('Zoom in');

    expect(sendA).not.toHaveBeenCalled();
    expect(sendB).not.toHaveBeenCalled();
  });

  it('drops the message when no conversation was registered at open time', () => {
    const send = vi.fn();
    const { result, rerender } = renderHandler();

    canvas.content = { type: 'visualizer' };
    rerender();
    result.current.bridge.registerSender({ conversationId: 'conv-a', send });
    result.current.handler?.('Zoom in');

    expect(send).not.toHaveBeenCalled();
  });
});
