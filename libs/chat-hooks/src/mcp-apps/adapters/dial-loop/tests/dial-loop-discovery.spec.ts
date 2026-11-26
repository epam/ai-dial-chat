import type { DeploymentDetailsDto } from '@epam/ai-dial-chat-api-client';
import { McpAppToolDiscovery } from '@epam/ai-dial-mcp-apps';
import { describe, expect, it, vi } from 'vitest';
import type { McpAppsApiClient } from '../../../mcp-apps-api-client';
import {
  discoverDialLoopTools,
  getDialLoopToolsetIds,
} from '../dial-loop-discovery';

const TOOLSET_ID = 'toolsets/public/example/Entity%20Lookup%20MCP%20Server__2.0.0';

const makeDetails = (
  schemaId: string,
  toolsets: unknown = [TOOLSET_ID],
): DeploymentDetailsDto =>
  ({
    applicationDetails: {
      applicationTypeSchemaId: schemaId,
      applicationProperties: { toolsets },
    },
  }) as unknown as DeploymentDetailsDto;

describe('getDialLoopToolsetIds', () => {
  it('returns the configured toolsets for a dial-loop application', () => {
    expect(
      getDialLoopToolsetIds(
        makeDetails(
          'https://core.example.com/custom_application_schemas/dial-loop',
        ),
      ),
    ).toEqual([TOOLSET_ID]);
  });

  it('returns nothing for another application schema', () => {
    expect(
      getDialLoopToolsetIds(
        makeDetails(
          'https://core.example.com/custom_application_schemas/quick-app',
        ),
      ),
    ).toEqual([]);
  });

  it('returns nothing when the details are missing or toolsets is not a list', () => {
    expect(getDialLoopToolsetIds(null)).toEqual([]);
    expect(
      getDialLoopToolsetIds(
        makeDetails(
          'https://core.example.com/custom_application_schemas/dial-loop',
          'x',
        ),
      ),
    ).toEqual([]);
  });
});

describe('discoverDialLoopTools', () => {
  it('keeps the real tool name and marks refs as configured', async () => {
    const client = {
      listAppTools: vi.fn().mockResolvedValue([
        {
          toolName: 'show_entity_card',
          resourceUri: 'ui://entity-card/index.html',
        },
      ]),
    } as unknown as McpAppsApiClient;

    const tools = await discoverDialLoopTools(client, [TOOLSET_ID]);

    expect(tools).toEqual([
      {
        toolsetId: TOOLSET_ID,
        resourceUri: 'ui://entity-card/index.html',
        toolName: 'show_entity_card',
        mcpToolName: 'show_entity_card',
        kind: 'toolset',
        discovery: McpAppToolDiscovery.Configured,
      },
    ]);
  });

  it('skips a toolset whose listing fails', async () => {
    const client = {
      listAppTools: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as McpAppsApiClient;

    expect(await discoverDialLoopTools(client, [TOOLSET_ID])).toEqual([]);
  });
});
