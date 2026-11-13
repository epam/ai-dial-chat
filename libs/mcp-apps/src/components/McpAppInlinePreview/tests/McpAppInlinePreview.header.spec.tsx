import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  CachedMcpAppResponse,
  McpAppHostAdapter,
  McpAppResponseCache,
  McpAppToolRef,
} from '../../../models/mcp-apps';
import {
  McpAppToolDiscovery,
  McpDeploymentKind,
} from '../../../types/mcp-apps';
import { McpAppInlinePreview } from '../McpAppInlinePreview';

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    McpAppCanvasRenderer: ({
      onAppInfo,
    }: {
      onAppInfo?: (info: { name: string; version: string }) => void;
    }) => {
      useEffect(() => {
        onAppInfo?.({ name: 'entity-card', version: '9.9.9' });
      }, [onAppInfo]);
      return <div>mounted app</div>;
    },
  };
});

const match: McpAppToolRef = {
  toolsetId: 'toolset-1',
  resourceUri: 'ui://weather',
  toolName: 'weather',
  mcpToolName: 'weather',
  kind: McpDeploymentKind.Toolset,
  discovery: McpAppToolDiscovery.Direct,
};

const response: CachedMcpAppResponse = { html: '<p>app</p>' };

const cache: McpAppResponseCache = {
  get: () => response,
  set: vi.fn(),
  invalidate: vi.fn(),
  getOrFetch: async () => response,
};

const hostAdapter: McpAppHostAdapter = {
  hostContext: {} as McpAppHostAdapter['hostContext'],
  hostInfo: { name: 'host', version: '1.0.0' },
  sandboxUrl: 'https://sandbox.example',
  fetchResourceHtml: vi.fn(async () => response.html),
  callTool: vi.fn(async () => ({
    content: [],
  })) as unknown as McpAppHostAdapter['callTool'],
};

describe('McpAppInlinePreview — header', () => {
  it('shows the tool and app names but not the app version', async () => {
    render(
      <McpAppInlinePreview
        match={match}
        cache={cache}
        cacheKey="message-0"
        hostAdapter={hostAdapter}
        onExpand={vi.fn()}
        expandAriaLabel="Expand"
        reloadAriaLabel="Reload"
        loadErrorLabel="Could not load the app"
        openedInCanvasLabel="Opened in canvas"
      />,
    );

    expect(await screen.findByText('entity-card')).toBeTruthy();
    expect(screen.queryByText('9.9.9')).toBeNull();
  });
});
