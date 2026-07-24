import { OverlayFeature } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatOverlay } from '../ChatOverlay';
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

  describe('conversation-list method forwarding', () => {
    it('throws a descriptive error for an unknown overlayId for each new method', () => {
      manager = new ChatOverlayManager();
      expect(() => manager?.getConversations('missing-id')).toThrow(
        /missing-id/,
      );
      expect(() => manager?.getSelectedConversations('missing-id')).toThrow(
        /missing-id/,
      );
      expect(() => manager?.selectConversation('missing-id', 'conv-1')).toThrow(
        /missing-id/,
      );
      expect(() => manager?.createConversation('missing-id')).toThrow(
        /missing-id/,
      );
      expect(() => manager?.createLocalConversation('missing-id')).toThrow(
        /missing-id/,
      );
      expect(() => manager?.deleteConversation('missing-id', 'conv-1')).toThrow(
        /missing-id/,
      );
      expect(() =>
        manager?.renameConversation('missing-id', 'conv-1', 'New name'),
      ).toThrow(/missing-id/);
    });

    it('forwards each new method to the underlying ChatOverlay instance with the same arguments', () => {
      manager = new ChatOverlayManager();
      manager.createOverlay({ overlayId: 'test', domain: DOMAIN });

      const getConversationsSpy = vi
        .spyOn(ChatOverlay.prototype, 'getConversations')
        .mockResolvedValue({ conversations: [] });
      const getSelectedSpy = vi
        .spyOn(ChatOverlay.prototype, 'getSelectedConversations')
        .mockResolvedValue({ conversations: [] });
      const selectSpy = vi
        .spyOn(ChatOverlay.prototype, 'selectConversation')
        .mockResolvedValue({});
      const createSpy = vi
        .spyOn(ChatOverlay.prototype, 'createConversation')
        .mockResolvedValue({ conversation: null });
      const createLocalSpy = vi
        .spyOn(ChatOverlay.prototype, 'createLocalConversation')
        .mockResolvedValue({ conversation: null });
      const deleteSpy = vi
        .spyOn(ChatOverlay.prototype, 'deleteConversation')
        .mockResolvedValue({});
      const renameSpy = vi
        .spyOn(ChatOverlay.prototype, 'renameConversation')
        .mockResolvedValue({});

      void manager.getConversations('test');
      void manager.getSelectedConversations('test');
      void manager.selectConversation('test', 'conv-1');
      void manager.createConversation('test', { firstMessage: 'Hi' });
      void manager.createLocalConversation('test');
      void manager.deleteConversation('test', 'conv-1');
      void manager.renameConversation('test', 'conv-1', 'New name');

      expect(getConversationsSpy).toHaveBeenCalledOnce();
      expect(getSelectedSpy).toHaveBeenCalledOnce();
      expect(selectSpy).toHaveBeenCalledWith('conv-1');
      expect(createSpy).toHaveBeenCalledWith({ firstMessage: 'Hi' });
      expect(createLocalSpy).toHaveBeenCalledOnce();
      expect(deleteSpy).toHaveBeenCalledWith('conv-1');
      expect(renameSpy).toHaveBeenCalledWith('conv-1', 'New name');

      getConversationsSpy.mockRestore();
      getSelectedSpy.mockRestore();
      selectSpy.mockRestore();
      createSpy.mockRestore();
      createLocalSpy.mockRestore();
      deleteSpy.mockRestore();
      renameSpy.mockRestore();
    });
  });

  it('forwards setOverlayOptions with enabledFeatures unchanged to the underlying ChatOverlay instance', () => {
    manager = new ChatOverlayManager();
    manager.createOverlay({ overlayId: 'test', domain: DOMAIN });

    const setOverlayOptionsSpy = vi
      .spyOn(ChatOverlay.prototype, 'setOverlayOptions')
      .mockResolvedValue({ applied: true });

    void manager.setOverlayOptions('test', {
      enabledFeatures: [OverlayFeature.Header],
    });

    expect(setOverlayOptionsSpy).toHaveBeenCalledWith({
      enabledFeatures: ['header'],
    });

    setOverlayOptionsSpy.mockRestore();
  });
});
