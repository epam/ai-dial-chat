import { act, fireEvent, render, screen } from '@testing-library/react';
import { use } from 'react';
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

/*
 * The stub renderer suspends until a test releases it, standing in for the
 * renderer chunk still downloading: either way the preview's `Suspense`
 * boundary is what the user sees.
 */
const rendererModule = vi.hoisted(() => {
  let release: () => void = () => undefined;
  const loaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { loaded, release: () => release() };
});

const SuspendingRenderer = () => {
  use(rendererModule.loaded);
  return <div>mounted app</div>;
};

vi.mock('@epam/ai-dial-attachment-canvas/mcp-app-renderer', () => ({
  McpAppCanvasRenderer: SuspendingRenderer,
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

describe('McpAppInlinePreview — renderer loading', () => {
  it('shows the loading spinner until the renderer arrives, then the app', async () => {
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
        loadingAriaLabel="Loading app"
        openedInCanvasLabel="Opened in canvas"
      />,
    );

    expect(await screen.findByLabelText('Loading app')).toBeTruthy();
    expect(screen.queryByText('mounted app')).toBeNull();

    await act(async () => {
      rendererModule.release();
    });

    expect(await screen.findByText('mounted app')).toBeTruthy();
    expect(screen.queryByLabelText('Loading app')).toBeNull();
  });

  it('keeps the reload action available while the renderer loads', async () => {
    render(
      <McpAppInlinePreview
        match={match}
        cache={cache}
        cacheKey="message-1"
        hostAdapter={hostAdapter}
        onExpand={vi.fn()}
        expandAriaLabel="Expand"
        reloadAriaLabel="Reload"
        loadErrorLabel="Could not load the app"
        openedInCanvasLabel="Opened in canvas"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Reload' }));

    expect(await screen.findByText('mounted app')).toBeTruthy();
  });
});
