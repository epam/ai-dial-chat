import type { Message } from '@epam/ai-dial-chat-shared';
import { useEffect, useRef } from 'react';
import {
  findLastMcpAppMessage,
  mcpAppCanvasKey,
  resolveMcpAppToolCallSeed,
} from '../../utils/mcp-app';
import type { McpAppToolRef } from '../conversation/useMcpAppTools';
import { useOpenMcpAppCanvas } from './useOpenMcpAppCanvas';

/**
 * Auto-opens the canvas for the last message in `messages` that has a
 * matched MCP App tool — per explicit design direction (design.md D5,
 * revised), this supersedes the original manual-only "Open App" trigger.
 * Guarded by a ref keyed to the message index so it only fires once per
 * newly-appeared match, not on every render/rerender (e.g. after the user
 * manually closes the canvas).
 */
export const useAutoOpenMcpAppCanvas = (
  messages: Message[],
  mcpAppTools: McpAppToolRef[],
): void => {
  const { openMcpAppCanvas } = useOpenMcpAppCanvas();
  const autoOpenedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const found = findLastMcpAppMessage(messages, mcpAppTools);
    if (!found) return;
    const key = mcpAppCanvasKey(found.messageIndex);
    if (autoOpenedKeyRef.current === key) return;
    autoOpenedKeyRef.current = key;
    void openMcpAppCanvas(
      found.match,
      key,
      resolveMcpAppToolCallSeed(
        messages[found.messageIndex],
        found.match.toolName,
      ),
    );
  }, [messages, mcpAppTools, openMcpAppCanvas]);
};
