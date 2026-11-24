import { fireEvent, render, screen } from '@testing-library/react';
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

/* The first renderer import fails, as a dropped chunk request would. */
const rendererModule = vi.hoisted(() => ({ isFailing: true }));

vi.mock('@epam/ai-dial-attachment-canvas/mcp-app-renderer', () => ({
  get McpAppCanvasRenderer() {
    if (rendererModule.isFailing) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return () => <div>mounted app</div>;
  },
}));

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

describe('McpAppInlinePreview — renderer load failure', () => {
  it('shows the load error, and reload loads the renderer again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
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

    expect(
      (await screen.findAllByText('Could not load the app')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('mounted app')).toBeNull();

    rendererModule.isFailing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(await screen.findByText('mounted app')).toBeTruthy();
    expect(screen.queryByText('Could not load the app')).toBeNull();
  });
});
