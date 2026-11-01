import {
  createDeploymentChangedMessage,
  useDeploymentChangeTracking,
} from '@epam/ai-dial-chat-hooks';
import { Message } from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { useDeployments } from '../context/DeploymentsContext';

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
  const onChange = useCallback(
    (previous: string | null, next: string) => {
      addStatusMessage(
        createDeploymentChangedMessage(previous, next) as Message,
      );
    },
    [addStatusMessage],
  );
  useDeploymentChangeTracking({
    conversationId,
    selectedDeploymentId: selectedItemId,
    isLoaded: isConversationLoaded,
    onChange,
  });
};
