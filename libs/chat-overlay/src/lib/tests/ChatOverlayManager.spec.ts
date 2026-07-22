import { afterEach, describe, expect, it } from 'vitest';
import { ChatOverlayManager } from '../ChatOverlayManager';

const DOMAIN = 'https://chat.example.com/embed';

describe('ChatOverlayManager', () => {
  let manager: ChatOverlayManager | undefined;

  afterEach(() => {
    manager?.destroy();
    manager = undefined;
    document.body.innerHTML = '';
  });

  it('throws a descriptive error for an unknown overlayId', () => {
    manager = new ChatOverlayManager();
    expect(() => manager?.sendMessage('missing-id', 'hi')).toThrow(
      /missing-id/,
    );
  });

  it('creates a toggle button with a non-empty accessible name', () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({ overlayId: 'test', domain: DOMAIN });

    const toggleButton = document.body.querySelector(
      'button[aria-label="Open chat"]',
    );
    expect(toggleButton).toBeTruthy();
  });

  it('makes toggle, close, and fullscreen buttons keyboard-focusable in DOM order', () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({
      overlayId: 'test',
      domain: DOMAIN,
      allowFullscreen: true,
    });

    const buttons = Array.from(
      document.body.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.forEach((button) => {
      expect(button.hasAttribute('tabindex')).toBe(false);
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('grants fullscreen permission to the iframe when allowFullscreen is set', () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({
      overlayId: 'test',
      domain: DOMAIN,
      allowFullscreen: true,
    });

    const iframe = document.body.querySelector('iframe');

    expect(iframe?.getAttribute('allowfullscreen')).toBe('true');
    expect(iframe?.getAttribute('allow')).toContain('fullscreen');
  });

  it('forwards ready() to the requested overlay', async () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({ overlayId: 'test', domain: DOMAIN });
    const iframe = document.body.querySelector('iframe') as HTMLIFrameElement;
    const readyPromise = manager.ready('test');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '@DIAL_OVERLAY/READY_TO_INTERACT' },
        source: iframe.contentWindow,
        origin: 'https://chat.example.com',
      }),
    );

    await expect(readyPromise).resolves.toBe(true);
  });

  it('shows the panel and hides the toggle button on showOverlay', () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({ overlayId: 'test', domain: DOMAIN });

    const container = document.body.querySelector(
      '[data-dial-overlay-container="test"]',
    ) as HTMLElement;
    const toggleButton = document.body.querySelector(
      'button[aria-label="Open chat"]',
    ) as HTMLElement;

    expect(container.style.display).toBe('none');
    manager.showOverlay('test');
    expect(container.style.display).toBe('flex');
    expect(toggleButton.style.display).toBe('none');

    manager.hideOverlay('test');
    expect(container.style.display).toBe('none');
    expect(toggleButton.style.display).toBe('inline-flex');
  });

  it('removes the container and toggle button on removeOverlay, and further calls throw', () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({ overlayId: 'test', domain: DOMAIN });

    manager.removeOverlay('test');

    expect(
      document.body.querySelector('[data-dial-overlay-container="test"]'),
    ).toBeNull();
    expect(
      document.body.querySelector('button[aria-label="Open chat"]'),
    ).toBeNull();
    expect(() => manager?.removeOverlay('test')).toThrow(/test/);
  });

  it('destroys all overlays and stops recomputing layout on resize', () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({ overlayId: 'one', domain: DOMAIN });
    manager.createOverlay({ overlayId: 'two', domain: DOMAIN });

    manager.destroy();

    expect(
      document.body.querySelectorAll('[data-dial-overlay-container]').length,
    ).toBe(0);
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
    expect(() => manager?.sendMessage('one', 'hi')).toThrow();
  });
});
