import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { McpAppToolRef } from '../../models/mcp-apps';
import { findMcpAppForMessage } from '../mcp-app';

const indirectTool: McpAppToolRef = {
  toolsetId: 'toolsets/public/entity',
  resourceUri: 'ui://entity-card/index.html',
  toolName: 'Entity_MCP_Server_show_entity_card',
  mcpToolName: 'show_entity_card',
  kind: 'toolset',
  discovery: 'indirect',
};

const directTool: McpAppToolRef = {
  ...indirectTool,
  toolName: 'show_entity_card',
  discovery: 'direct',
};

const makeMessage = (
  history?: { call?: string; result?: string },
  role: Message['role'] = MessageRole.Assistant,
): Message =>
  ({
    role,
    content: '',
    custom_content: history && {
      state: {
        tool_execution_history: [
          ...(history.call
            ? [
                {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: { name: history.call, arguments: '{}' },
                    },
                  ],
                },
              ]
            : []),
          ...(history.result
            ? [
                {
                  role: 'tool',
                  tool_call_id: 'call_1',
                  content: history.result,
                },
              ]
            : []),
        ],
      },
    },
  }) as unknown as Message;

describe('findMcpAppForMessage', () => {
  it('matches an indirect tool whose call has finished', () => {
    const message = makeMessage({
      call: indirectTool.toolName,
      result: 'card',
    });

    expect(findMcpAppForMessage(message, [indirectTool])).toBe(indirectTool);
  });

  it('shows nothing for an indirect tool before any call is reported, so a later question in the conversation gets no card while it streams', () => {
    expect(findMcpAppForMessage(makeMessage(), [indirectTool])).toBeUndefined();
    expect(
      findMcpAppForMessage(makeMessage({}), [indirectTool]),
    ).toBeUndefined();
  });

  it('shows nothing while the matching call has no result yet', () => {
    const message = makeMessage({ call: indirectTool.toolName });

    expect(findMcpAppForMessage(message, [indirectTool])).toBeUndefined();
  });

  it('shows nothing when the message called a different tool', () => {
    const message = makeMessage({ call: 'weather_get_weather', result: 'sun' });

    expect(findMcpAppForMessage(message, [indirectTool])).toBeUndefined();
  });

  it('always matches a directly discovered tool, since a self-hosted app reports no tool calls', () => {
    expect(findMcpAppForMessage(makeMessage(), [directTool])).toBe(directTool);
  });

  it('ignores non-assistant messages and an empty tool list', () => {
    const userMessage = makeMessage(
      { call: indirectTool.toolName, result: 'card' },
      MessageRole.User,
    );

    expect(findMcpAppForMessage(userMessage, [indirectTool])).toBeUndefined();
    expect(findMcpAppForMessage(makeMessage(), [])).toBeUndefined();
  });
});
