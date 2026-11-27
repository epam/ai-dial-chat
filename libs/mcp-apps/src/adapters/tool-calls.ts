import type { Message } from '@epam/ai-dial-chat-shared';
import type { McpAppToolCall } from '../models/mcp-apps';
import { extractDialLoopToolCalls } from './dial-loop/dial-loop-tool-calls';
import { extractQuickAppToolCalls } from './quick-app/quick-app-tool-calls';

/**
 * Tool-call adapters, one per kind of app, in priority order. Each reads the
 * shape its agent reports and yields nothing for a message that does not carry
 * it. The first adapter that yields calls wins, so a quick app's structured
 * `state` is never mixed with, or overridden by, text recovered from stages.
 * To drop a kind, delete its folder and its line here.
 */
const TOOL_CALL_ADAPTERS: ReadonlyArray<
  (message: Message) => McpAppToolCall[]
> = [extractQuickAppToolCalls, extractDialLoopToolCalls];

/**
 * Returns the tool calls of the first adapter that recovers any from one message.
 * @param message - assistant message
 */
export const extractMessageToolCalls = (message: Message): McpAppToolCall[] => {
  for (const extract of TOOL_CALL_ADAPTERS) {
    const calls = extract(message);
    if (calls.length > 0) return calls;
  }
  return [];
};
