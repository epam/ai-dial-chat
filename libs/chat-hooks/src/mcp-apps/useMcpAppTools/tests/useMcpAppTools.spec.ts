import type {
  DeploymentDetailsDto,
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type { Message } from '@epam/ai-dial-chat-shared';
import { McpAppToolDiscovery } from '@epam/ai-dial-mcp-apps';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { McpAppsApiClient } from '../../mcp-apps-api-client';
import { useMcpAppTools } from '../useMcpAppTools';

const TOOLSET_ID = 'toolsets/bucket/Entity%20MCP%20Server__1.0.0';

const makeClient = (): McpAppsApiClient =>
  ({
    listAppTools: vi.fn().mockResolvedValue([
      {
        toolName: 'show_entity_card',
        resourceUri: 'ui://entity-card/index.html',
      },
    ]),
  }) as unknown as McpAppsApiClient;

const makeMessages = (toolCallName: string): Message[] =>
  [
    {
      role: 'assistant',
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
                  function: { name: toolCallName, arguments: '{}' },
                },
              ],
            },
          ],
        },
      },
    },
  ] as unknown as Message[];

const quickApp = {
  id: 'applications/bucket/quick',
  type: 'application',
  features: { mcp: false },
} as unknown as DeploymentItemDto;

const makeToolset = (displayName: string): DialToolsetDto =>
  ({ id: TOOLSET_ID, toolset: TOOLSET_ID, displayName }) as DialToolsetDto;

describe('useMcpAppTools indirect discovery', () => {
  it('matches a toolset whose display name contains spaces against the sanitized tool-call name', async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useMcpAppTools(
        client,
        quickApp,
        makeMessages('Entity_MCP_Server_show_entity_card'),
        [makeToolset('Entity MCP Server')],
      ),
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(client.listAppTools).toHaveBeenCalledWith(TOOLSET_ID, 'toolset');
    expect(result.current[0]).toMatchObject({
      toolsetId: TOOLSET_ID,
      toolName: 'Entity_MCP_Server_show_entity_card',
      mcpToolName: 'show_entity_card',
      discovery: McpAppToolDiscovery.Indirect,
    });
  });

  it('still matches a display name that needs no sanitization', async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useMcpAppTools(
        client,
        quickApp,
        makeMessages('entity-mcp_show_entity_card'),
        [makeToolset('entity-mcp')],
      ),
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].toolName).toBe('entity-mcp_show_entity_card');
  });

  it('queries only the public toolset when a private one shares its display name', async () => {
    const client = makeClient();
    const publicId = 'toolsets/public/Entity%20MCP%20Server__1.0.0';
    const { result } = renderHook(() =>
      useMcpAppTools(
        client,
        quickApp,
        makeMessages('Entity_MCP_Server_show_entity_card'),
        [
          makeToolset('Entity MCP Server'),
          {
            id: publicId,
            toolset: publicId,
            displayName: 'Entity MCP Server',
          } as DialToolsetDto,
        ],
      ),
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(client.listAppTools).toHaveBeenCalledOnce();
    expect(client.listAppTools).toHaveBeenCalledWith(publicId, 'toolset');
    expect(result.current[0].toolsetId).toBe(publicId);
  });

  it('does not query a toolset whose name does not prefix any tool call', async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useMcpAppTools(client, quickApp, makeMessages('weather_get_weather'), [
        makeToolset('Entity MCP Server'),
      ]),
    );

    await Promise.resolve();
    expect(client.listAppTools).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });
});

describe('useMcpAppTools DIAL loop discovery', () => {
  const LOOP_ID = 'applications/bucket/loop__1.0.0';
  const loopApp = {
    id: LOOP_ID,
    type: 'application',
    features: { mcp: false },
  } as unknown as DeploymentItemDto;
  const makeDetails = (id: string): DeploymentDetailsDto =>
    ({
      id,
      applicationDetails: {
        applicationTypeSchemaId:
          'https://core.example.com/custom_application_schemas/dial-loop',
        applicationProperties: { toolsets: [TOOLSET_ID] },
      },
    }) as unknown as DeploymentDetailsDto;
  const stageMessages = [
    {
      role: 'assistant',
      content: '',
      custom_content: {
        stages: [
          {
            index: 0,
            name: 'show_entity_card (0.04s, Start: 12:45:41)',
            status: 'completed',
            content: '**Request**\n\n- `id`: x\n\n**Response**\n\n```\n{}\n```',
          },
        ],
      },
    },
  ] as unknown as Message[];

  it('lists the configured toolsets once a message reports a stage tool call', async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useMcpAppTools(client, loopApp, stageMessages, [], makeDetails(LOOP_ID)),
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(client.listAppTools).toHaveBeenCalledWith(TOOLSET_ID, 'toolset');
    expect(result.current[0]).toMatchObject({
      toolName: 'show_entity_card',
      discovery: McpAppToolDiscovery.Configured,
    });
  });

  it('ignores details that belong to another deployment', async () => {
    const client = makeClient();
    renderHook(() =>
      useMcpAppTools(
        client,
        loopApp,
        stageMessages,
        [],
        makeDetails('applications/bucket/other__1.0.0'),
      ),
    );

    await Promise.resolve();
    expect(client.listAppTools).not.toHaveBeenCalled();
  });

  it('does not query toolsets before any stage tool call exists', async () => {
    const client = makeClient();
    renderHook(() =>
      useMcpAppTools(client, loopApp, [], [], makeDetails(LOOP_ID)),
    );

    await Promise.resolve();
    expect(client.listAppTools).not.toHaveBeenCalled();
  });
});
