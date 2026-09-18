import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MCP_APPS_CLASS } from '../../../constants/public-class-names';
import type {
  CachedMcpAppResponse,
  McpAppHostAdapter,
  McpAppResponseCache,
  McpAppToolRef,
} from '../../../models/mcp-apps';
import { McpAppInlinePreview } from '../McpAppInlinePreview';

/*
 * The public class names are this package's styling contract. A lost class
 * fails silently — the build passes, types pass, lint passes, and a host's
 * stylesheet simply stops applying — so each one is asserted here.
 *
 * The card and its header carry no role of their own, so the toolbar inside
 * the header is the locator and the assertions walk up from it: querying *by*
 * the class would still pass with the class on the wrong node.
 */

/*
 * Only the renderer is stubbed: the module also carries the enums this lib
 * imports, and an object-literal mock would drop them, failing the whole file
 * at import time rather than at an assertion.
 */
vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    McpAppCanvasRenderer: () => <div>mounted app</div>,
  };
});

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

const match: McpAppToolRef = {
  toolsetId: 'toolset-1',
  resourceUri: 'ui://weather',
  toolName: 'weather',
  mcpToolName: 'weather',
  kind: 'toolset',
  discovery: 'direct',
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
  sandboxUrl: 'https://sandbox.example',
  fetchResourceHtml: vi.fn(async () => response.html),
  callTool: vi.fn(async () => ({
    content: [],
  })) as unknown as McpAppHostAdapter['callTool'],
};

const renderPreview = () =>
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
    />,
  );

describe('McpAppInlinePreview — public class names', () => {
  it('stamps the preview card and its header', async () => {
    renderPreview();

    const toolbar = await screen.findByRole('toolbar', {
      name: 'MCP app actions',
    });

    expect(
      closestWithClass(toolbar, MCP_APPS_CLASS.previewHeader),
    ).toBeTruthy();
    expect(closestWithClass(toolbar, MCP_APPS_CLASS.preview)).toBeTruthy();
  });

  it('forwards every colour override as a CSS custom property', async () => {
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
        colors={{
          previewBackground: 'rgb(1, 2, 3)',
          previewBorder: 'rgb(4, 5, 6)',
          previewHeaderBorder: 'rgb(7, 8, 9)',
        }}
      />,
    );

    /*
     * Each variable is read by a rule in the component's stylesheet, so a prop
     * whose variable never reaches the DOM is a prop that silently does
     * nothing — the dead-style failure the styling guide calls out.
     */
    const root = closestWithClass(
      await screen.findByRole('toolbar', { name: 'MCP app actions' }),
      MCP_APPS_CLASS.preview,
    ) as HTMLElement;

    expect(root.style.getPropertyValue('--mcpapp-preview-bg')).toBe(
      'rgb(1, 2, 3)',
    );
    expect(root.style.getPropertyValue('--mcpapp-preview-border')).toBe(
      'rgb(4, 5, 6)',
    );
    expect(root.style.getPropertyValue('--mcpapp-preview-header-border')).toBe(
      'rgb(7, 8, 9)',
    );
  });
});
