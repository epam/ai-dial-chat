import {
  MessageRole,
  type Message,
  type MessageState,
} from '@epam/ai-dial-chat-shared';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type {
  CallMcpAppTool,
  McpAppToolCallSeed,
  McpAppToolRef,
} from '../models/mcp-apps';

/** A tool-call request paired with its result content, keyed by `tool_call_id`. */
interface ResolvedToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

/** Parses an OpenAI tool call's raw JSON-encoded `function.arguments` string, tolerating a malformed/non-object payload. */
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
 */
const resolveToolCalls = (
  state: MessageState | undefined,
): Map<string, ResolvedToolCall> => {
  const calls = new Map<string, ResolvedToolCall>();

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
 * Collects every real tool-call name seen across `messages`' `custom_content.state`
 * (in whichever known orchestrator shape is present). Used to discover an MCP-capable
 * toolset that a non-MCP application delegates to internally.
 */
export const collectToolCallNames = (messages: Message[]): Set<string> => {
  const names = new Set<string>();
  for (const message of messages) {
    for (const call of resolveToolCalls(
      message.custom_content?.state,
    ).values()) {
      names.add(call.name);
    }
  }
  return names;
};

/**
 * Returns the `mcpAppTools` entry that best matches this message: the one
 * whose name was actually called (per `custom_content.state`, in whichever
 * of its two known orchestrator-specific shapes is present), or — since the
 * trigger is meant to always be available once the deployment supports MCP
 * Apps — falls back to the first discovered tool when no real call matches
 * yet (e.g. the model hasn't called a tool this turn). Returns `undefined`
 * for non-assistant messages or when the deployment has no MCP-Apps-capable
 * tool at all.
 */
export const findMcpAppForMessage = (
  message: Message,
  mcpAppTools: McpAppToolRef[],
): McpAppToolRef | undefined => {
  if (mcpAppTools.length === 0 || message.role !== MessageRole.Assistant) {
    return undefined;
  }
  const calledNames = new Set(
    [...resolveToolCalls(message.custom_content?.state).values()].map(
      (call) => call.name,
    ),
  );
  return (
    mcpAppTools.find((tool) => calledNames.has(tool.toolName)) ?? mcpAppTools[0]
  );
};

/** Stable key identifying a message's MCP App canvas in an attachment canvas's `attachmentId` tracking, mirroring the `${messageIndex}:${attachmentId}` scheme used for regular attachment tiles. */
export const mcpAppCanvasKey = (messageIndex: number): string =>
  `${messageIndex}:mcp-app`;

/**
 * Identifies which seed a `useMcpAppResponseCache` entry was resolved from,
 * so a cache lookup can tell a settled tool-call seed apart from the
 * no-tool-call-parsed-yet seed a freshly-streamed message mounts with.
 */
export const computeMcpAppSeedKey = (
  toolCall: McpAppToolCallSeed | undefined,
): string | undefined =>
  toolCall == null ? undefined : JSON.stringify(toolCall.toolInput ?? null);

/**
 * Seeds the mounted app's initial `toolInput`/`toolResult` from the
 * message's real tool-call data (`custom_content.state`, in whichever of its
 * two known orchestrator-specific shapes is present) — `toolInput` is the
 * tool call's real structured arguments; `toolResult` is still a lossy
 * wrapper around the result message's plain-text `content`, since that's
 * still all the orchestrator's state carries (no `_meta` or
 * `structuredContent` survives into it). Returns `undefined` if no matching
 * tool call is found for `toolName`.
 */
export const resolveMcpAppToolCallSeed = (
  message: Message,
  toolName: string,
): McpAppToolCallSeed | undefined => {
  const state = message.custom_content?.state;
  if (!state) return undefined;

  const matched = [...resolveToolCalls(state).values()].find(
    (call) => call.name === toolName,
  );
  if (!matched) return undefined;

  return {
    toolInput: matched.args,
    toolResult:
      matched.result != null
        ? { content: [{ type: 'text', text: matched.result }] }
        : undefined,
  };
};

/**
 * Resolves the `toolResult` an MCP App canvas should be seeded with. Prefers
 * a live re-call of the tool (through `callTool`) over `seed.toolResult`'s
 * lossy plain-text reconstruction, since a host's conversation state
 * typically never carries the tool's real `structuredContent` — only the
 * orchestrator's flattened prose summary.
 *
 * Only attempted when the MCP endpoint is unambiguous — `match.kind ===
 * 'application'`, i.e. the deployment is itself the MCP server. The
 * `'toolset'` kind also covers indirect, name-prefix-guessed matches, where
 * re-calling could hit the wrong tool or re-trigger a non-idempotent side
 * effect — those keep the lossy seed. Falls back to `seed?.toolResult` if the
 * live call fails (e.g. the deployment has no live MCP session outside the
 * original conversation turn) or has no arguments to replay.
 */
export const resolveMcpAppToolResult = async (
  match: McpAppToolRef,
  seed: McpAppToolCallSeed | undefined,
  callTool: CallMcpAppTool,
): Promise<CallToolResult | undefined> => {
  if (match.kind !== 'application' || seed?.toolInput == null) {
    return seed?.toolResult;
  }

  try {
    return await callTool(
      match.toolsetId,
      match.mcpToolName,
      seed.toolInput,
      match.kind,
    );
  } catch {
    return seed.toolResult;
  }
};
