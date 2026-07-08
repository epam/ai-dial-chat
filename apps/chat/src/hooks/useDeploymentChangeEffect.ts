import { Message } from '@epam/ai-dial-chat-shared';
import { useEffect, useRef } from 'react';
import { useDeployments } from '../context/DeploymentsContext';
import { createDeploymentChangedMessage } from '../utils/message-factory';

/**
 * Watches the active deployment selection and appends a status message to the
 * conversation whenever the user switches models mid-conversation.
 *
 * Does not fire on initial mount. Also does not fire for the deployment
 * restoration that happens when an existing conversation is loaded — only
 * genuine user-initiated switches after load are tracked.
 *
 * @param isConversationLoaded - true once the conversation has finished
 *   fetching and its state is stable. The hook is silenced until this flag
 *   is true, which prevents spurious messages during the initial sync of the
 *   deployment selector to the conversation's last-used agent.
 */
export const useDeploymentChangeEffect = (
  conversationId: string | undefined,
  addStatusMessage: (msg: Message) => void,
  isConversationLoaded: boolean,
): void => {
  const { selectedItemId } = useDeployments();
  const prevIdRef = useRef<string | null>(selectedItemId);
  const isLoadedRef = useRef(false);

  /*
   * When the conversation finishes loading, capture the current selectedItemId
   * (which has already been restored from conversation history by the caller)
   * as the baseline. This prevents treating that restoration as a change.
   * Reset when the conversation unloads so the next load gets a fresh baseline.
   */
  useEffect(() => {
    if (!isConversationLoaded) {
      isLoadedRef.current = false;
      return;
    }
    if (!isLoadedRef.current) {
      isLoadedRef.current = true;
      prevIdRef.current = selectedItemId;
    }
  }, [isConversationLoaded, selectedItemId]);

  useEffect(() => {
    if (!conversationId || !isConversationLoaded) return;
    if (prevIdRef.current === selectedItemId) return;

    const previous = prevIdRef.current;
    prevIdRef.current = selectedItemId;

    if (selectedItemId == null) return;

    addStatusMessage(
      createDeploymentChangedMessage(previous, selectedItemId) as Message,
    );
  }, [conversationId, selectedItemId, addStatusMessage, isConversationLoaded]);
};
