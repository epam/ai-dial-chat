import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  McpAppInlinePreviewStatus,
  type McpAppHostAdapter,
  type McpAppResponseCache,
  type McpAppToolCallSeed,
  type McpAppToolRef,
} from '../../../models/mcp-apps';
import { useMcpAppInlinePreview } from '../useMcpAppInlinePreview';

const match: McpAppToolRef = {
  toolsetId: 'toolsets/public/entity',
  resourceUri: 'ui://entity-card/index.html',
  toolName: 'entity_show_entity_card',
  mcpToolName: 'show_entity_card',
  kind: 'toolset',
  discovery: 'indirect',
};

const makeCache = (): McpAppResponseCache => {
  const entries = new Map<string, unknown>();
  return {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    getOrFetch: vi.fn(async (key, seedKey, fetchFn) => {
      const entryKey = `${key}::${seedKey}`;
      if (!entries.has(entryKey)) entries.set(entryKey, await fetchFn());
      return entries.get(entryKey) as Awaited<ReturnType<typeof fetchFn>>;
    }),
  };
};

const makeAdapter = (): McpAppHostAdapter => ({
  hostContext: {},
  hostInfo: { name: 'host', version: '1' },
  sandboxUrl: 'https://sandbox.example.com',
  fetchResourceHtml: vi.fn().mockResolvedValue('<html></html>'),
  callTool: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'card' }],
    structuredContent: { name: 'Entity' },
  }),
});

/** A fresh object with the same data, as `resolveMcpAppToolCallSeed` produces after any message update. */
const makeSeed = (id: string): McpAppToolCallSeed => ({
  toolInput: { id },
});

describe('useMcpAppInlinePreview', () => {
  it('keeps the same toolInput and stays ready when the tool call is re-created with the same data', async () => {
    const cache = makeCache();
    const adapter = makeAdapter();
    const { result, rerender } = renderHook(
      ({ toolCall }) =>
        useMcpAppInlinePreview(match, toolCall, cache, 'key', adapter),
      { initialProps: { toolCall: makeSeed('toolsets/public/a') } },
    );
    await waitFor(() =>
      expect(result.current.status).toBe(McpAppInlinePreviewStatus.Ready),
    );
    const firstToolInput = result.current.content?.toolInput;
    const firstToolResult = result.current.content?.toolResult;

    rerender({ toolCall: makeSeed('toolsets/public/a') });

    expect(result.current.status).toBe(McpAppInlinePreviewStatus.Ready);
    expect(result.current.content?.toolInput).toBe(firstToolInput);
    expect(result.current.content?.toolResult).toBe(firstToolResult);
    expect(adapter.callTool).toHaveBeenCalledOnce();
  });

  it('delivers the new toolInput once the tool call really changes', async () => {
    const cache = makeCache();
    const adapter = makeAdapter();
    const { result, rerender } = renderHook(
      ({ toolCall }) =>
        useMcpAppInlinePreview(match, toolCall, cache, 'key', adapter),
      { initialProps: { toolCall: makeSeed('toolsets/public/a') } },
    );
    await waitFor(() =>
      expect(result.current.status).toBe(McpAppInlinePreviewStatus.Ready),
    );

    rerender({ toolCall: makeSeed('toolsets/public/b') });

    await waitFor(() =>
      expect(result.current.content?.toolInput).toEqual({
        id: 'toolsets/public/b',
      }),
    );
    expect(adapter.callTool).toHaveBeenCalledTimes(2);
  });
});
