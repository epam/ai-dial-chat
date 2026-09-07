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
 * of its two known orchestrator-specific shapes is present).
 *
 * If no real call matches, a `discovery: 'direct'` tool (the deployment
 * itself IS this MCP server, whether it's a bare Toolset or an Application —
 * see `useMcpAppTools`) always wins regardless: such a deployment's own
 * response IS its MCP App responding, and it typically never populates
 * `custom_content.state` at all — it isn't an LLM-orchestrated tool-call
 * turn, so there is no call to find evidence of in the first place (the same
 * class of self-hosted-app gap `design.md`'s D9 "Known gap" documents for
 * discovery — here it recurs at per-message matching).
 *
 * Otherwise (a `discovery: 'indirect'` match — a real MCP-capable toolset a
 * different, tool-calling deployment delegates to, guessed by name-prefix), a
 * real match is required once the message has settled; while still
 * streaming, `custom_content.state` may not have caught up with a tool call
 * the model already made this turn, so the first such tool is guessed
 * optimistically rather than popping in a beat late. Once settled, a
 * deployment that finished without calling any MCP-capable toolset must
 * never show the trigger, even though the deployment supports MCP Apps in
 * general.
 *
 * Returns `undefined` for non-assistant messages or when the deployment has
 * no MCP-Apps-capable tool at all.
 */
export const findMcpAppForMessage = (
  message: Message,
  mcpAppTools: McpAppToolRef[],
  isStreaming: boolean,
): McpAppToolRef | undefined => {
  if (mcpAppTools.length === 0 || message.role !== MessageRole.Assistant) {
    return undefined;
  }
  const calledNames = new Set(
    [...resolveToolCalls(message.custom_content?.state).values()].map(
      (call) => call.name,
    ),
  );
  const matched = mcpAppTools.find((tool) => calledNames.has(tool.toolName));
  if (matched) return matched;
  const selfHosted = mcpAppTools.find((tool) => tool.discovery === 'direct');
  if (selfHosted) return selfHosted;
  return isStreaming ? mcpAppTools[0] : undefined;
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
 * `structuredContent` survives into it). When the same tool was called more
 * than once this turn (e.g. the model retried after a failed first attempt
 * with corrected arguments), the **last** matching call is used — an earlier
 * attempt's failure is superseded, not authoritative. Returns `undefined` if
 * no matching tool call is found for `toolName`.
 */
export const resolveMcpAppToolCallSeed = (
  message: Message,
  toolName: string,
): McpAppToolCallSeed | undefined => {
  const state = message.custom_content?.state;
  if (!state) return undefined;

  const matched = [...resolveToolCalls(state).values()]
    .reverse()
    .find((call) => call.name === toolName);
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
 * orchestrator's flattened prose summary, which is often not enough for the
 * app's UI to render anything at all.
 *
 * Attempted whenever the call is confirmed safe:
 * - `match.discovery === 'direct'` — the deployment the host is talking to
 *   IS this MCP server (whether a bare Toolset or an Application), so
 *   `toolsetId`/`mcpToolName`/`kind` are unambiguous. Called even when `seed`
 *   has no `toolInput`, since a self-hosting MCP App never populates
 *   `custom_content.state` in the first place (see `findMcpAppForMessage`) —
 *   `{}` is passed instead, the same "give me your current/initial state"
 *   call the app's own resource would make on `ui/initialize`.
 * - `seed?.toolInput != null` — a `discovery: 'indirect'` match (the toolset
 *   a *different*, tool-calling deployment appears to delegate to) whose
 *   `toolName` was matched against a *real* tool call actually seen in
 *   `custom_content.state` (`findMcpAppForMessage`'s name-match branch, not
 *   its streaming-optimistic `mcpAppTools[0]` guess). Once a real call is
 *   confirmed, re-calling it with the exact same `toolsetId`/args it was
 *   really invoked with carries no more risk than the direct case.
 *
 * Only the streaming-optimistic guess (`discovery: 'indirect'` with no real
 * call seen yet, so `seed` is `undefined`) is skipped — that toolset/tool
 * pairing is still an unconfirmed guess, and re-calling it could hit the
 * wrong tool or re-trigger a non-idempotent side effect; it keeps
 * `seed?.toolResult` (`undefined` here) as-is. Falls back to
 * `seed?.toolResult` if an attempted live call fails (e.g. the deployment
 * has no live MCP session outside the original conversation turn).
 */
export const resolveMcpAppToolResult = async (
  match: McpAppToolRef,
  seed: McpAppToolCallSeed | undefined,
  callTool: CallMcpAppTool,
): Promise<CallToolResult | undefined> => {
  const isConfirmed = match.discovery === 'direct' || seed?.toolInput != null;
  if (!isConfirmed) {
    return seed?.toolResult;
  }

  try {
    return await callTool(
      match.toolsetId,
      match.mcpToolName,
      seed?.toolInput ?? {},
      match.kind,
    );
  } catch {
    return seed?.toolResult;
  }
};
