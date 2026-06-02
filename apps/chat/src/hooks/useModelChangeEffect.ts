import { Message } from '@epam/ai-dial-chat-shared';
import { useEffect, useRef } from 'react';
import { useDeployments } from '../context/DeploymentsContext';
import { createModelChangedMessage } from '../utils/message-factory';

/**
 * Watches the active deployment selection and appends a status message to the
 * conversation whenever the user switches models mid-conversation.
 * Does not fire on initial mount.
 */
export const useModelChangeEffect = (
  conversationId: string | undefined,
  addStatusMessage: (msg: Message) => void,
): void => {
  const { selectedItemId } = useDeployments();
  const prevIdRef = useRef<string | null>(selectedItemId);

  useEffect(() => {
    if (!conversationId) return;
    if (prevIdRef.current === selectedItemId) return;

    const previous = prevIdRef.current;
    prevIdRef.current = selectedItemId;

    if (selectedItemId === null) return;

    addStatusMessage(createModelChangedMessage(previous, selectedItemId));
  }, [conversationId, selectedItemId, addStatusMessage]);
};
