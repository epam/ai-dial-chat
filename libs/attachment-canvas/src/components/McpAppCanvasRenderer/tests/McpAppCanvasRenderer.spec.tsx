import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpAppCanvasContent } from '../../../models/attachment-canvas';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { McpAppCanvasRenderer } from '../McpAppCanvasRenderer';

/*
 * The real `AppBridge` opens a `postMessage` transport to a sandbox iframe
 * that jsdom never loads, so the bridge is replaced by a double that records
 * the handlers the component assigns. Every assertion below drives the
 * component through those handlers, which is exactly how a mounted app
 * reaches it in production.
 */
interface BridgeDouble {
  onopenlink?: (params: { url: string }) => Promise<{ isError?: boolean }>;
  onrequestdisplaymode?: (params: {
    mode: string;
  }) => Promise<{ mode: string }>;
  oncalltool?: (params: { name: string; arguments: unknown }) => unknown;
  notificationHandler?: (message: {
    params: { containerDimensions?: Record<string, number> };
  }) => void;
  setNotificationHandler: (schema: unknown, handler: unknown) => void;
  setHostContext: (context: unknown) => void;
  close: () => Promise<void>;
}

interface AppFrameDouble {
  onError?: (error: Error) => void;
}

const bridges: BridgeDouble[] = [];
const closeSpy = vi.fn(() => Promise.resolve());
/* Captures each render's props so a test can invoke `onError` the way a real sandboxed app failure would. */
const appFrames: AppFrameDouble[] = [];

vi.mock('@mcp-ui/client', () => ({
  AppBridge: class {
    setNotificationHandler(_schema: unknown, handler: unknown) {
      (this as unknown as BridgeDouble).notificationHandler =
        handler as BridgeDouble['notificationHandler'];
    }
    setHostContext() {
      /* no-op: the component only needs the call to not throw */
    }
    close() {
      return closeSpy();
    }
    constructor() {
      bridges.push(this as unknown as BridgeDouble);
    }
  },
  /* Stands in for the real sandbox iframe `AppFrame` mounts. */
  AppFrame: (props: AppFrameDouble) => {
    appFrames.push(props);
    return <iframe title="mcp-app" />;
  },
}));

vi.mock('@modelcontextprotocol/ext-apps/app-bridge', () => ({
  McpUiHostContextChangedNotificationSchema: { method: 'host-context-changed' },
}));

const baseContent: McpAppCanvasContent = {
  type: AttachmentContentType.McpApp,
  html: '<p>app</p>',
  sandboxUrl: 'https://sandbox.example.com/',
  onToolCall: vi.fn(),
};

const mountApp = async (content: McpAppCanvasContent = baseContent) => {
  render(<McpAppCanvasRenderer content={content} />);
  await waitFor(() => expect(bridges).toHaveLength(1));
  return bridges[0];
};

beforeEach(() => {
  bridges.length = 0;
  appFrames.length = 0;
  closeSpy.mockClear();
  /* `window` is shared across tests, so its spies must not accumulate calls. */
  vi.restoreAllMocks();
});

describe('McpAppCanvasRenderer — ui/open-link', () => {
  it('reports a successful open even though `noopener` makes `window.open` return null', async () => {
    /*
     * Regression: `noopener` severs the opener relationship, so a successful
     * open still resolves to `null`. Treating that as a blocked pop-up made
     * the app receive `isError` for every link it opened.
     */
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(null as unknown as Window);
    const bridge = await mountApp();

    await expect(
      bridge.onopenlink?.({ url: 'https://example.com/docs' }),
    ).resolves.toEqual({});
    expect(open).toHaveBeenCalledWith(
      'https://example.com/docs',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('rejects a non-http(s) scheme without reaching window.open', async () => {
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(null as unknown as Window);
    const bridge = await mountApp();

    await expect(
      bridge.onopenlink?.({ url: 'javascript:alert(1)' }),
    ).resolves.toEqual({ isError: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects a malformed URL', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null as unknown as Window);
    const bridge = await mountApp();

    await expect(bridge.onopenlink?.({ url: 'not a url' })).resolves.toEqual({
      isError: true,
    });
  });

  it('honours a host handler that refuses the URL', async () => {
    const bridge = await mountApp({
      ...baseContent,
      onOpenLink: () => false,
    });

    await expect(
      bridge.onopenlink?.({ url: 'https://example.com' }),
    ).resolves.toEqual({ isError: true });
  });
});

describe('McpAppCanvasRenderer — ui/request-display-mode', () => {
  it('answers with the current mode when the host supplies no handler', async () => {
    const bridge = await mountApp({
      ...baseContent,
      hostContext: { displayMode: 'fullscreen' },
    });

    await expect(
      bridge.onrequestdisplaymode?.({ mode: 'pip' }),
    ).resolves.toEqual({ mode: 'fullscreen' });
  });

  it('falls back to `inline` when there is no host context at all', async () => {
    const bridge = await mountApp();

    await expect(
      bridge.onrequestdisplaymode?.({ mode: 'fullscreen' }),
    ).resolves.toEqual({ mode: 'inline' });
  });

  it('answers with the mode the host actually applied', async () => {
    const bridge = await mountApp({
      ...baseContent,
      hostContext: { displayMode: 'inline' },
      onRequestDisplayMode: () => 'fullscreen',
    });

    await expect(
      bridge.onrequestdisplaymode?.({ mode: 'pip' }),
    ).resolves.toEqual({ mode: 'fullscreen' });
  });
});

describe('McpAppCanvasRenderer — tools/call', () => {
  it('forwards the app-issued call to the host', async () => {
    const onToolCall = vi.fn().mockResolvedValue({ content: [] });
    const bridge = await mountApp({ ...baseContent, onToolCall });

    await bridge.oncalltool?.({ name: 'search', arguments: { q: 'dial' } });

    expect(onToolCall).toHaveBeenCalledWith('search', { q: 'dial' });
  });
});

describe('McpAppCanvasRenderer — app-requested container dimensions', () => {
  it('applies a requested fixed size while inline', async () => {
    const bridge = await mountApp();

    bridge.notificationHandler?.({
      params: { containerDimensions: { width: 480, height: 320 } },
    });

    const frame = screen.getByTitle('mcp-app');
    expect(frame.style.width).toBe('480px');
    expect(frame.style.height).toBe('320px');
  });

  it('leaves the iframe untouched when no dimensions are requested', async () => {
    const bridge = await mountApp();

    bridge.notificationHandler?.({ params: {} });

    const frame = screen.getByTitle('mcp-app');
    expect(frame.getAttribute('style')).toBeNull();
  });

  it('applies an app-requested ceiling while inline', async () => {
    const bridge = await mountApp();

    bridge.notificationHandler?.({
      params: { containerDimensions: { maxWidth: 670, maxHeight: 382 } },
    });

    const frame = screen.getByTitle('mcp-app');
    expect(frame.style.maxWidth).toBe('670px');
    expect(frame.style.maxHeight).toBe('382px');
  });

  it('ignores an app-requested ceiling in fullscreen', async () => {
    /*
     * Regression: `.fullscreenFrame` forces `width`/`height` to `100%`, but
     * `max-width`/`max-height` are separate properties, so an inline ceiling
     * kept shrinking the fullscreen canvas.
     */
    const bridge = await mountApp({
      ...baseContent,
      hostContext: { displayMode: 'fullscreen' },
    });

    bridge.notificationHandler?.({
      params: { containerDimensions: { maxWidth: 670, maxHeight: 382 } },
    });

    const frame = screen.getByTitle('mcp-app');
    expect(frame.style.maxWidth).toBe('');
    expect(frame.style.maxHeight).toBe('');
  });

  it('clears a ceiling left over from an earlier inline request', async () => {
    const bridge = await mountApp({
      ...baseContent,
      hostContext: { displayMode: 'fullscreen' },
    });
    const frame = screen.getByTitle('mcp-app');
    frame.style.maxWidth = '670px';
    frame.style.maxHeight = '382px';

    bridge.notificationHandler?.({ params: { containerDimensions: {} } });

    expect(frame.style.maxWidth).toBe('');
    expect(frame.style.maxHeight).toBe('');
  });
});

describe('McpAppCanvasRenderer — bridge lifecycle', () => {
  it('closes the bridge on unmount', async () => {
    const { unmount } = render(<McpAppCanvasRenderer content={baseContent} />);
    await waitFor(() => expect(bridges).toHaveLength(1));

    unmount();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('McpAppCanvasRenderer — AppFrame onError', () => {
  it('unmounts AppFrame and shows the error message under errorLabel', async () => {
    render(
      <McpAppCanvasRenderer
        content={baseContent}
        errorLabel="Failed to load MCP App"
      />,
    );
    await waitFor(() => expect(appFrames).toHaveLength(1));

    appFrames[0].onError?.(
      new Error('Timed out waiting for sandbox proxy iframe to be ready'),
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Failed to load MCP App');
    expect(alert.textContent).toContain(
      'Timed out waiting for sandbox proxy iframe to be ready',
    );
    expect(screen.queryByTitle('mcp-app')).toBeNull();
  });

  it('remounts cleanly (new AppBridge, no error overlay) when given a new key, as a reload does', async () => {
    const { rerender } = render(
      <McpAppCanvasRenderer key="attempt-1" content={baseContent} />,
    );
    await waitFor(() => expect(appFrames).toHaveLength(1));
    appFrames[0].onError?.(new Error('boom'));
    expect(await screen.findByRole('alert')).toBeTruthy();

    rerender(<McpAppCanvasRenderer key="attempt-2" content={baseContent} />);

    await waitFor(() => expect(bridges).toHaveLength(2));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTitle('mcp-app')).toBeTruthy();
  });
});
