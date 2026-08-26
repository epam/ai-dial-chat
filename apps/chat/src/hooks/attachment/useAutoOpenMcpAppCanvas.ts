import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
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
 *
 * A message's `custom_content.state` keeps changing while the message is
 * still streaming, so the first match for a given message index can carry an
 * in-flight tool call whose result hasn't landed yet. Re-seeding is allowed
 * to repeat for the same message index as long as the canvas is still the
 * one showing it (`attachmentId === key`), so the app picks up the real
 * `toolInput`/`toolResult` once streaming settles instead of freezing on that
 * first partial state. Once the user manually closes the canvas (or another
 * attachment replaces it), `attachmentId` no longer matches `key` and this
 * hook stops touching it.
 */
export const useAutoOpenMcpAppCanvas = (
  messages: Message[],
  mcpAppTools: McpAppToolRef[],
): void => {
  const { openMcpAppCanvas } = useOpenMcpAppCanvas();
  const { attachmentId } = useAttachmentCanvas();
  const autoOpenedKeyRef = useRef<string | null>(null);
  const lastSeedJsonRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const found = findLastMcpAppMessage(messages, mcpAppTools);
    if (!found) return;
    const key = mcpAppCanvasKey(found.messageIndex);
    const isSameKey = autoOpenedKeyRef.current === key;
    if (isSameKey && attachmentId !== key) return;

    const seed = resolveMcpAppToolCallSeed(
      messages[found.messageIndex],
      found.match.toolName,
    );
    const seedJson = JSON.stringify(seed);
    if (isSameKey && lastSeedJsonRef.current === seedJson) return;

    autoOpenedKeyRef.current = key;
    lastSeedJsonRef.current = seedJson;
    void openMcpAppCanvas(found.match, key, seed);
  }, [messages, mcpAppTools, openMcpAppCanvas, attachmentId]);
};
