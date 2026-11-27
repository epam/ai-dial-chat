import {
  StageStatus,
  type Message,
  type Stage,
} from '@epam/ai-dial-chat-shared';
import type { McpAppToolCall } from '../../models/mcp-apps';
import { parseJsonObject } from '../../utils/json';

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
 * Whether a stage reports a tool call: its content starts with a `**Request**` section.
 * @param stage - a message stage
 */
const isToolStage = (stage: Stage): boolean =>
  (stage.content ?? '').startsWith(STAGE_REQUEST_MARKER);

/**
 * Reads the tool calls a DIAL loop reported as stages. A stage without a `**Request**` section is not a tool call, and `result` stays undefined until the `**Response**` block arrives or when the stage failed.
 * @param stages - stages of one assistant message
 */
const resolveStageToolCalls = (
  stages: Stage[] | undefined,
): McpAppToolCall[] => {
  const calls: McpAppToolCall[] = [];
  for (const stage of stages ?? []) {
    if (!isToolStage(stage)) continue;
    const content = stage.content ?? '';

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
      isDisplayDerived: true,
      structuredResult:
        response == null ? undefined : parseJsonObject(response),
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
 * Whether any message carries a stage that reports a tool call. Exits at the first one without parsing, so it is cheap enough to run on every streamed chunk.
 * @param messages - conversation messages
 */
export const hasDialLoopToolCalls = (messages: Message[]): boolean =>
  messages.some((message) => message.custom_content?.stages?.some(isToolStage));
