import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useVisualizerMessage } from '../../context/VisualizerMessageContext';
import { useUiFeature } from '../useUiFeature';

interface Params {
  conversationId: string | undefined;
  isStreaming: boolean;
  isReadOnly: boolean;
  handleSend: (message: string, attachments: never[]) => Promise<void> | void;
}

/**
 * Turns a visualizer `SEND_MESSAGE` into a user message in this conversation,
 * as the legacy `ALLOW_VISUALIZER_SEND_MESSAGES` did. Publishes the handler to
 * `VisualizerMessageContext` so the app-shell canvas can reach it, and returns
 * it for the inline visualizers — or `undefined` while the operator flag is
 * off. The message is dropped while a response streams, when the conversation
 * is read-only, or when an overlay host enabled `disabled-send`; a deployment
 * that disables the text input still accepts it, since its visualizer may be
 * its only input.
 */
export const useVisualizerMessageSendHandler = ({
  conversationId,
  isStreaming,
  isReadOnly,
  handleSend,
}: Params): ((content: string) => void) | undefined => {
  const isEnabled = useFeatureFlag('visualizerSendMessages');
  const { registerSender } = useVisualizerMessage();
  const isSendDisabled = useUiFeature(OverlayFeature.DisabledSend);

  /* Read at call time: the visualizer posts long after the render that built
   * the handler, and the handler must not change identity per stream chunk. */
  const latestRef = useRef({
    isStreaming,
    isReadOnly,
    isSendDisabled,
    handleSend,
  });
  /* Synced after commit, not during render, so a discarded concurrent render
   * cannot reset the same-tick streaming guard below. */
  useLayoutEffect(() => {
    latestRef.current = { isStreaming, isReadOnly, isSendDisabled, handleSend };
  });

  const send = useCallback((content: string) => {
    const latest = latestRef.current;
    if (latest.isStreaming || latest.isReadOnly || latest.isSendDisabled) {
      return;
    }
    /* Two posts in the same tick would both see the pre-stream state; treat
     * the conversation as streaming until the next render reports it. */
    latestRef.current = { ...latest, isStreaming: true };
    void latest.handleSend(content, []);
  }, []);

  useEffect(() => {
    if (!isEnabled || !conversationId) return;
    registerSender({ conversationId, send });
    return () => registerSender(null);
  }, [isEnabled, conversationId, registerSender, send]);

  return isEnabled && conversationId ? send : undefined;
};
