import type { ToolsetsApi } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import { createMcpAppsApiClient } from '../mcp-apps-api-client';

const ENCODED_TOOLSET_ID = 'toolsets/bucket/Entity%20MCP%20Server__1.0.0';
const RAW_TOOLSET_ID = 'toolsets/bucket/Entity MCP Server__1.0.0';

describe('createMcpAppsApiClient', () => {
  it('sends an encoded toolset id to the resource endpoint without double-encoding it', async () => {
    const getToolsetMcpAppResourceRaw = vi
      .fn()
      .mockResolvedValue({ raw: { text: async () => '<html></html>' } });
    const client = createMcpAppsApiClient({
      getToolsetMcpAppResourceRaw,
    } as unknown as ToolsetsApi);

    await client.fetchResourceHtml(
      ENCODED_TOOLSET_ID,
      'ui://entity-card/index.html',
    );

    expect(getToolsetMcpAppResourceRaw).toHaveBeenCalledWith({
      toolsetName: ENCODED_TOOLSET_ID,
      resourceUri: 'ui://entity-card/index.html',
    });
  });

  it('sends an encoded toolset id to the tool-call endpoint without double-encoding it', async () => {
    const callToolsetMcpAppTool = vi.fn().mockResolvedValue({ result: {} });
    const client = createMcpAppsApiClient({
      callToolsetMcpAppTool,
    } as unknown as ToolsetsApi);

    await client.callTool(
      ENCODED_TOOLSET_ID,
      'show_entity_card',
      {},
      'toolset',
    );

    expect(callToolsetMcpAppTool).toHaveBeenCalledWith(
      expect.objectContaining({ toolsetName: ENCODED_TOOLSET_ID }),
    );
  });

  it('encodes a raw toolset id so the backend accepts spaces', async () => {
    const getToolsetMcpAppResourceRaw = vi
      .fn()
      .mockResolvedValue({ raw: { text: async () => '<html></html>' } });
    const client = createMcpAppsApiClient({
      getToolsetMcpAppResourceRaw,
    } as unknown as ToolsetsApi);

    await client.fetchResourceHtml(
      RAW_TOOLSET_ID,
      'ui://entity-card/index.html',
    );

    expect(getToolsetMcpAppResourceRaw).toHaveBeenCalledWith(
      expect.objectContaining({ toolsetName: ENCODED_TOOLSET_ID }),
    );
  });
});
