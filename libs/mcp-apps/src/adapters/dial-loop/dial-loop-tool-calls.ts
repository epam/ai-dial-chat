import {
  StageStatus,
  type Message,
  type Stage,
} from '@epam/ai-dial-chat-shared';
import type { McpAppToolCall } from '../../models/mcp-apps';

/*
 * DIAL loop adapter (tool-call side). TEMPORARY: replace once DIAL Core or the
 * loop reports MCP Apps tool calls natively. A loop reports a tool call only as
 * a stage named `<tool> (<n>s, Start: <time>)` whose content is display
 * Markdown: a `**Request**` bullet list, then a `**Response**` code block. That
 * text is not a contract. The discovery side lives in
 * `libs/chat-hooks/src/mcp-apps/adapters/dial-loop`.
 */

const STAGE_TIMING_SUFFIX = /\s+\(\d+(?:\.\d+)?s(?:,\s*Start:[^)]*)?\)$/;
const STAGE_REQUEST_BULLET = /^-\s+`([^`]+)`:\s?(.*)$/;
const STAGE_REQUEST_MARKER = '**Request**';
const STAGE_RESPONSE_MARKER = '**Response**';
const STAGE_RESPONSE_BLOCK = /\*\*Response\*\*\s*```[^\n]*\n([\s\S]*?)\n?```/;

const MARKDOWN_ESCAPE = /\\([\\`*_{}[\]()#+\-.!~|<>])/g;

/**
 * Parses one `**Request**` bullet value, keeping JSON scalars/objects typed and falling back to the raw string with Markdown escapes removed. The loop renders values for display (escaped underscores, decoded percent-escapes), so the result is not guaranteed to equal what the tool received.
 * @param raw - text after the bullet's key
 */
const parseStageArgValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(MARKDOWN_ESCAPE, '$1');
  }
};

/**
 * Parses the `**Response**` text as a JSON object, or returns undefined when it is anything else.
 * @param response - text of the `**Response**` code block
 */
const parseStructuredResponse = (
  response: string | undefined,
): Record<string, unknown> | undefined => {
  if (response == null) return undefined;
  try {
    const parsed: unknown = JSON.parse(response);
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Reads the tool calls a DIAL loop reported as stages. A stage without a `**Request**` section is not a tool call, and `result` stays undefined until the `**Response**` block arrives or when the stage failed.
 * @param stages - stages of one assistant message
 */
const resolveStageToolCalls = (
  stages: Stage[] | undefined,
): McpAppToolCall[] => {
  const calls: McpAppToolCall[] = [];
  for (const stage of stages ?? []) {
    const content = stage.content ?? '';
    if (!content.startsWith(STAGE_REQUEST_MARKER)) continue;

    const requestEnd = content.indexOf(STAGE_RESPONSE_MARKER);
    const requestText = content.slice(
      STAGE_REQUEST_MARKER.length,
      requestEnd === -1 ? undefined : requestEnd,
    );
    const args: Record<string, unknown> = {};
    for (const line of requestText.split('\n')) {
      const bullet = STAGE_REQUEST_BULLET.exec(line.trim());
      if (bullet) args[bullet[1]] = parseStageArgValue(bullet[2]);
    }

    const response =
      stage.status === StageStatus.Failed
        ? undefined
        : STAGE_RESPONSE_BLOCK.exec(content)?.[1];
    calls.push({
      name: (stage.name ?? '').replace(STAGE_TIMING_SUFFIX, ''),
      args,
      result: response,
      structuredResult: parseStructuredResponse(response),
    });
  }
  return calls;
};

/**
 * Returns the tool calls a DIAL loop reported in `custom_content.stages`.
 * @param message - assistant message
 */
export const extractDialLoopToolCalls = (message: Message): McpAppToolCall[] =>
  resolveStageToolCalls(message.custom_content?.stages);

/**
 * Collects every tool name a DIAL loop reported across `messages`, used to decide whether the application's configured toolsets must be inspected.
 * @param messages - conversation messages
 */
export const collectDialLoopToolCallNames = (
  messages: Message[],
): Set<string> => {
  const names = new Set<string>();
  for (const message of messages) {
    for (const call of extractDialLoopToolCalls(message)) {
      names.add(call.name);
    }
  }
  return names;
};
