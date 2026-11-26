import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { extractMessageToolCalls } from '../adapters/tool-calls';
import type {
  CallMcpAppTool,
  McpAppToolCallSeed,
  McpAppToolRef,
} from '../models/mcp-apps';
import { McpAppToolDiscovery } from '../types/mcp-apps';

const LIVE_CALL_RETRY_DELAY_MS = 500;
const LIVE_CALL_RETRY_JITTER_MS = 500;

/**
 * Resolves after the given delay.
 * @param ms - delay in milliseconds
 */
const waitFor = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns the `mcpAppTools` entry that best matches this message: the one
 * whose name was actually called and has returned a result (per
 * `custom_content.state`, in whichever of its two known orchestrator-specific
 * shapes is present).
 *
 * If no real call matches, a `McpAppToolDiscovery.Direct` tool (the deployment
 * itself IS this MCP server, whether it's a bare Toolset or an Application —
 * see `useMcpAppTools`) always wins regardless: such a deployment's own
 * response IS its MCP App responding, and it typically never populates
 * `custom_content.state` at all — it isn't an LLM-orchestrated tool-call
 * turn, so there is no call to find evidence of in the first place (the same
 * class of self-hosted-app gap `openspec/changes/archive/2026-09-30-mcp-apps-support/design.md`'s D9 "Known gap" documents for
 * discovery — here it recurs at per-message matching).
 *
 * Otherwise (a `McpAppToolDiscovery.Indirect` match — a real MCP-capable toolset a
 * different, tool-calling deployment delegates to, guessed by name-prefix), a
 * call to that tool that has already returned a result is required, whether
 * the message is streaming or settled. A call without a result is still
 * running, and with no call at all the model may never call the tool, so
 * guessing earlier would mount the app on every answer in a conversation that
 * once used it, and the app would wait for data that never arrives.
 *
 * Returns `undefined` for non-assistant messages or when the deployment has
 * no MCP-Apps-capable tool at all.
 */
export const findMcpAppForMessage = (
  message: Message,
  mcpAppTools: McpAppToolRef[],
): McpAppToolRef | undefined => {
  if (mcpAppTools.length === 0 || message.role !== MessageRole.Assistant) {
    return undefined;
  }
  const finishedNames = new Set(
    extractMessageToolCalls(message)
      .filter((call) => call.result != null)
      .map((call) => call.name),
  );
  const matched = mcpAppTools.find((tool) => finishedNames.has(tool.toolName));
  if (matched) return matched;
  return mcpAppTools.find(
    (tool) => tool.discovery === McpAppToolDiscovery.Direct,
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
  const matched = extractMessageToolCalls(message)
    .reverse()
    .find((call) => call.name === toolName);
  if (!matched) return undefined;

  return {
    toolInput: matched.args,
    toolResult:
      matched.result != null
        ? {
            content: [{ type: 'text', text: matched.result }],
            ...(matched.structuredResult && {
              structuredContent: matched.structuredResult,
            }),
          }
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
 * - `match.discovery === McpAppToolDiscovery.Direct` — the deployment the host is talking to
 *   IS this MCP server (whether a bare Toolset or an Application), so
 *   `toolsetId`/`mcpToolName`/`kind` are unambiguous. Called even when `seed`
 *   has no `toolInput`, since a self-hosting MCP App never populates
 *   `custom_content.state` in the first place (see `findMcpAppForMessage`) —
 *   `{}` is passed instead, the same "give me your current/initial state"
 *   call the app's own resource would make on `ui/initialize`.
 * - `seed?.toolInput != null` — a `McpAppToolDiscovery.Indirect` match (the toolset
 *   a *different*, tool-calling deployment appears to delegate to) whose
 *   `toolName` was matched against a *real* tool call actually seen in
 *   `custom_content.state` (`findMcpAppForMessage`'s name-match branch).
 *   Once a real call is confirmed, re-calling it with the exact same `toolsetId`/args it was
 *   really invoked with carries no more risk than the direct case.
 *
 * A `McpAppToolDiscovery.Configured` match is never re-called: its arguments
 * were recovered from a stage's display Markdown (escaped characters, decoded
 * percent-escapes), so replaying them can hit a different resource. It keeps
 * `seed?.toolResult`, which carries the stage's parsed `structuredContent`.
 *
 * An `indirect` match with no seed is skipped — that toolset/tool pairing
 * is unconfirmed, and re-calling it could hit the wrong tool or re-trigger a
 * non-idempotent side effect; it keeps `seed?.toolResult` as-is. Falls back to
 * `seed?.toolResult` if an attempted live call fails twice (e.g. the
 * deployment has no live MCP session outside the original conversation turn).
 * A failed live call is retried once after a short randomized delay.
 */
export const resolveMcpAppToolResult = async (
  match: McpAppToolRef,
  seed: McpAppToolCallSeed | undefined,
  callTool: CallMcpAppTool,
): Promise<CallToolResult | undefined> => {
  const isConfirmed =
    match.discovery === McpAppToolDiscovery.Direct ||
    (match.discovery === McpAppToolDiscovery.Indirect &&
      seed?.toolInput != null);
  if (!isConfirmed) {
    return seed?.toolResult;
  }

  const liveCall = () =>
    callTool(
      match.toolsetId,
      match.mcpToolName,
      seed?.toolInput ?? {},
      match.kind,
    );

  try {
    return await liveCall();
  } catch {
    /*
     * Retried on any error on purpose: this call already re-runs on every
     * mount, so one more attempt adds no new kind of risk, and the lib cannot
     * tell a lost response from a failed request. The jitter keeps sibling
     * cards that failed together from retrying as one burst.
     */
    await waitFor(
      LIVE_CALL_RETRY_DELAY_MS + Math.random() * LIVE_CALL_RETRY_JITTER_MS,
    );
  }

  try {
    return await liveCall();
  } catch {
    return seed?.toolResult;
  }
};
