import type { Message, MessageState } from '@epam/ai-dial-chat-shared';
import type { McpAppToolCall } from '../../models/mcp-apps';

/*
 * Quick-app adapter (tool-call side). TEMPORARY: replace once DIAL Core
 * reports MCP Apps tool calls natively. Assumes the orchestrator writes tool
 * calls into `custom_content.state` as `tool_messages` or
 * `tool_execution_history` and names each tool `<ToolsetDisplayName>_<tool>`.
 * The discovery side lives in `libs/chat-hooks/src/mcp-apps/adapters/quick-app`.
 */

const INVALID_TOOL_NAME_CHARS = /[^a-zA-Z0-9_-]+/g;
const MAX_TOOL_NAME_LENGTH = 64;

/**
 * Parses an OpenAI tool call's raw JSON-encoded `function.arguments` string, tolerating a malformed/non-object payload.
 * @param raw - the JSON-encoded arguments string
 */
const parseOpenAiToolArgs = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

/**
 * Pairs each tool-call request with its result, by `tool_call_id`, across
 * whichever of `state`'s two known orchestrator-specific shapes is present:
 * `tool_messages` (LangChain-style, `type: 'ai'|'tool'`) or
 * `tool_execution_history` (OpenAI chat-completion-style, `role:
 * 'assistant'|'tool'`, `tool_calls[].function.{name,arguments}`).
 * @param state - the message's `custom_content.state`
 */
const resolveStateToolCalls = (
  state: MessageState | undefined,
): Map<string, McpAppToolCall> => {
  const calls = new Map<string, McpAppToolCall>();

  for (const toolMessage of state?.tool_messages ?? []) {
    for (const call of toolMessage.tool_calls ?? []) {
      calls.set(call.id, { name: call.name, args: call.args });
    }
    if (toolMessage.type === 'tool' && toolMessage.tool_call_id) {
      const call = calls.get(toolMessage.tool_call_id);
      if (call) call.result = toolMessage.content;
    }
  }

  for (const historyMessage of state?.tool_execution_history ?? []) {
    for (const call of historyMessage.tool_calls ?? []) {
      calls.set(call.id, {
        name: call.function.name,
        args: parseOpenAiToolArgs(call.function.arguments),
      });
    }
    if (historyMessage.role === 'tool' && historyMessage.tool_call_id) {
      const call = calls.get(historyMessage.tool_call_id);
      if (call) call.result = historyMessage.content;
    }
  }

  return calls;
};

/**
 * Returns the tool calls a quick app recorded in `custom_content.state`.
 * @param message - assistant message
 */
export const extractQuickAppToolCalls = (
  message: Message,
): McpAppToolCall[] => [
  ...resolveStateToolCalls(message.custom_content?.state).values(),
];

/**
 * Collects every tool-call name seen across `messages`' `custom_content.state`, used to discover the MCP-capable toolset a non-MCP application delegates to.
 * @param messages - conversation messages
 */
export const collectToolCallNames = (messages: Message[]): Set<string> => {
  const names = new Set<string>();
  for (const message of messages) {
    for (const call of extractQuickAppToolCalls(message)) {
      names.add(call.name);
    }
  }
  return names;
};

/**
 * Reproduces the tool-name sanitization QuickApps applies to
 * `${toolsetName}_${toolName}` before sending a tool to the LLM
 * (`sanitize_toolname` in `epam/ai-dial-quickapps-backend`,
 * `src/quickapp/common/utils.py`): every run of characters outside
 * `[a-zA-Z0-9_-]` becomes a single `_`, a name not starting with a letter or `_`
 * gets a leading `_`, and the result is cut to 64 characters.
 * @param input - raw `${toolsetName}_${toolName}` (or `${toolsetName}_` prefix)
 */
export const sanitizeToolName = (input: string): string => {
  let sanitized = input.replace(INVALID_TOOL_NAME_CHARS, '_');
  if (sanitized !== '' && !/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized.slice(0, MAX_TOOL_NAME_LENGTH);
};
