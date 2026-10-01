import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import { useCallback, useEffect, useRef } from 'react';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useVisualizerMessage } from '../../context/VisualizerMessageContext';

/**
 * Returns the `onVisualizerSendMessage` callback for the app-shell attachment
 * canvas, or `undefined` while the operator flag is off. The canvas outlives
 * navigation, so each opened content is bound to the conversation that was
 * active when it opened; a message from a visualizer opened elsewhere is
 * dropped rather than sent into whichever conversation is showing now.
 */
export const useCanvasVisualizerMessageHandler = ():
  ((content: string) => void) | undefined => {
  const isEnabled = useFeatureFlag('visualizerSendMessages');
  const { content } = useAttachmentCanvas();
  const { getRegisteredConversationId, sendMessage } = useVisualizerMessage();
  const sourceConversationIdRef = useRef<string | undefined>(undefined);

  /* Every `openCanvas` call happens inside a conversation, so the conversation
   * registered when the content changes is the one that opened it. */
  useEffect(() => {
    sourceConversationIdRef.current = getRegisteredConversationId();
  }, [content, getRegisteredConversationId]);

  const handleSendMessage = useCallback(
    (message: string) => {
      const sourceConversationId = sourceConversationIdRef.current;
      if (sourceConversationId == null) return;
      sendMessage(message, sourceConversationId);
    },
    [sendMessage],
  );

  return isEnabled ? handleSendMessage : undefined;
};
