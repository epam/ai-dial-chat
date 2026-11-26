import {
  MessageRole,
  StageStatus,
  type Message,
  type Stage,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { McpAppToolRef } from '../../../models/mcp-apps';
import {
  McpAppToolDiscovery,
  McpDeploymentKind,
} from '../../../types/mcp-apps';
import {
  findMcpAppForMessage,
  resolveMcpAppToolCallSeed,
} from '../../../utils/mcp-app';
import { collectDialLoopToolCallNames } from '../dial-loop-tool-calls';

const configuredTool: McpAppToolRef = {
  toolsetId: 'toolsets/public/example/Entity%20Lookup%20MCP%20Server__2.0.0',
  resourceUri: 'ui://entity-card/index.html',
  toolName: 'show_entity_card',
  mcpToolName: 'show_entity_card',
  kind: McpDeploymentKind.Toolset,
  discovery: McpAppToolDiscovery.Configured,
};

const toolStage: Stage = {
  index: 8,
  name: 'show_entity_card (0.04s, Start: 12:45:41)',
  status: StageStatus.Completed,
  content:
    '**Request**\n\n- `id`: dial-rag\n- `limit`: 3\n\n**Response**\n\n```\n{"entity":{"name":"DIAL RAG"}}\n```',
};

const makeMessage = (stages: Stage[]): Message =>
  ({
    role: MessageRole.Assistant,
    content: '',
    custom_content: { stages },
  }) as Message;

describe('stage-based tool calls (DIAL loop)', () => {
  it('collects the tool name without the timing suffix and ignores non-tool stages', () => {
    const names = collectDialLoopToolCallNames([
      makeMessage([
        {
          index: 0,
          name: 'Staging (1.86s, Start: 12:45:28)',
          status: StageStatus.Completed,
          content: 'done',
        },
        toolStage,
      ]),
    ]);

    expect([...names]).toEqual(['show_entity_card']);
  });

  it('matches a configured tool whose stage has a response', () => {
    expect(
      findMcpAppForMessage(makeMessage([toolStage]), [configuredTool]),
    ).toBe(configuredTool);
  });

  it('does not match while the stage has no response yet', () => {
    const running: Stage = {
      ...toolStage,
      status: null,
      content: '**Request**\n\n- `id`: dial-rag',
    };

    expect(
      findMcpAppForMessage(makeMessage([running]), [configuredTool]),
    ).toBeUndefined();
  });

  it('does not match a failed stage', () => {
    const failed: Stage = { ...toolStage, status: StageStatus.Failed };

    expect(
      findMcpAppForMessage(makeMessage([failed]), [configuredTool]),
    ).toBeUndefined();
  });

  it('seeds toolInput from the request bullets and toolResult from the response block', () => {
    expect(
      resolveMcpAppToolCallSeed(makeMessage([toolStage]), 'show_entity_card'),
    ).toEqual({
      toolInput: { id: 'dial-rag', limit: 3 },
      toolResult: {
        content: [{ type: 'text', text: '{"entity":{"name":"DIAL RAG"}}' }],
        structuredContent: { entity: { name: 'DIAL RAG' } },
      },
    });
  });

  it('removes Markdown escapes from string request values', () => {
    const escaped: Stage = {
      ...toolStage,
      content:
        '**Request**\n\n- `id`: Entity Card\\_\\_1.0.0\n\n**Response**\n\n```\nplain text\n```',
    };

    expect(
      resolveMcpAppToolCallSeed(makeMessage([escaped]), 'show_entity_card'),
    ).toEqual({
      toolInput: { id: 'Entity Card__1.0.0' },
      toolResult: { content: [{ type: 'text', text: 'plain text' }] },
    });
  });

  it('prefers the structured state of a quick app over stages in the same message', () => {
    const message = {
      role: MessageRole.Assistant,
      content: '',
      custom_content: {
        state: {
          tool_execution_history: [
            {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'show_entity_card',
                    arguments: '{"id":"real"}',
                  },
                },
              ],
            },
            { role: 'tool', tool_call_id: 'call_1', content: 'state result' },
          ],
        },
        stages: [toolStage],
      },
    } as unknown as Message;

    expect(resolveMcpAppToolCallSeed(message, 'show_entity_card')).toEqual({
      toolInput: { id: 'real' },
      toolResult: { content: [{ type: 'text', text: 'state result' }] },
    });
  });
});
