import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import {
  useVisualizerMessage,
  VisualizerMessageProvider,
} from '../../../context/VisualizerMessageContext';
import { useUiFeature } from '../../useUiFeature';
import { useVisualizerMessageSendHandler } from '../useVisualizerMessageSendHandler';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

vi.mock('../../useUiFeature', () => ({ useUiFeature: vi.fn() }));

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseUiFeature = vi.mocked(useUiFeature);

interface HookProps {
  conversationId?: string;
  isStreaming?: boolean;
  isReadOnly?: boolean;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <VisualizerMessageProvider>{children}</VisualizerMessageProvider>
);

const renderHandler = (initialProps: HookProps = {}) => {
  const handleSend = vi.fn();
  const view = renderHook(
    (props: HookProps) => ({
      handler: useVisualizerMessageSendHandler({
        conversationId:
          'conversationId' in props ? props.conversationId : 'conv-a',
        isStreaming: props.isStreaming ?? false,
        isReadOnly: props.isReadOnly ?? false,
        handleSend,
      }),
      bridge: useVisualizerMessage(),
    }),
    { wrapper, initialProps },
  );
  return { ...view, handleSend };
};

describe('useVisualizerMessageSendHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockImplementation(
      (key?: string) => key === 'visualizerSendMessages',
    );
    mockUseUiFeature.mockReturnValue(false);
  });

  it('sends the content as a user message without attachments', () => {
    const { result, handleSend } = renderHandler();

    result.current.handler?.('Next page');

    expect(handleSend).toHaveBeenCalledWith('Next page', []);
  });

  it('returns no handler and registers nothing while the flag is off', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    const { result, handleSend } = renderHandler();

    result.current.bridge.sendMessage('Next page');

    expect(result.current.handler).toBeUndefined();
    expect(result.current.bridge.getRegisteredConversationId()).toBeUndefined();
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('drops the message while the assistant is streaming', () => {
    const { result, handleSend } = renderHandler({ isStreaming: true });

    result.current.handler?.('Next page');

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('drops the message in a read-only conversation', () => {
    const { result, handleSend } = renderHandler({ isReadOnly: true });

    result.current.handler?.('Next page');

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('drops the message when the overlay host enabled disabled-send', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.DisabledSend,
    );
    const { result, handleSend } = renderHandler();

    result.current.handler?.('Next page');

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('sends only the first of two messages posted before the stream starts', () => {
    const { result, handleSend } = renderHandler();

    result.current.handler?.('first');
    result.current.handler?.('second');

    expect(handleSend).toHaveBeenCalledOnce();
    expect(handleSend).toHaveBeenCalledWith('first', []);
  });

  it('registers the sender for the canvas under the conversation id', () => {
    const { result, handleSend } = renderHandler();

    result.current.bridge.sendMessage('Zoom in', 'conv-a');

    expect(result.current.bridge.getRegisteredConversationId()).toBe('conv-a');
    expect(handleSend).toHaveBeenCalledWith('Zoom in', []);
  });

  it('keeps the handler identity stable across streaming state changes', () => {
    const { result, rerender } = renderHandler();
    const first = result.current.handler;

    rerender({ isStreaming: true });
    rerender({ isStreaming: false });

    expect(result.current.handler).toBe(first);
  });

  it('reads the latest streaming state when the message arrives', () => {
    const { result, rerender, handleSend } = renderHandler();

    rerender({ isStreaming: true });
    result.current.handler?.('Next page');

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('unregisters the sender on unmount', () => {
    const { result, unmount } = renderHandler();
    const { bridge } = result.current;

    unmount();

    expect(bridge.getRegisteredConversationId()).toBeUndefined();
  });

  it('returns no handler without a conversation id', () => {
    const { result } = renderHandler({ conversationId: undefined });

    expect(result.current.handler).toBeUndefined();
  });
});
