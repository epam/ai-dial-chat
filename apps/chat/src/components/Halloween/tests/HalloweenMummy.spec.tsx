import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as mummy from '../../../utils/halloween-mummy';
import HalloweenMummy from '../HalloweenMummy';

vi.mock('@epam/ai-dial-conversation-input', () => ({
  CONVERSATION_INPUT_CLASS: { wrapper: 'dial-ci-wrapper' },
}));

describe('mummy motion lifecycle', () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'animate',
  );
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalAnimate)
      Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });
  const setup = (reduced: boolean) => {
    const events = new EventTarget();
    const media = {
      matches: reduced,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(),
    });
    const target = {
      element: document.createElement('div'),
      rect: new DOMRect(300, 300, 700, 140),
    };
    const find = vi
      .spyOn(mummy, 'getMummyComposerTarget')
      .mockReturnValue(target);
    const stop = vi.fn();
    const animate = vi.spyOn(mummy, 'animateMummyPush').mockReturnValue(stop);
    return {
      find,
      stop,
      animate,
      reduce: () =>
        act(() => {
          media.matches = true;
          events.dispatchEvent(new Event('change'));
        }),
    };
  };
  it('leaves the composer alone when reduced motion is enabled', () => {
    const { animate } = setup(true);
    render(<HalloweenMummy />);
    expect(animate).not.toHaveBeenCalled();
  });
  it('restores the input if reduced motion is enabled during a push', async () => {
    const { animate, stop, reduce } = setup(false);
    render(<HalloweenMummy />);
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
    reduce();
    expect(stop).toHaveBeenCalledOnce();
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
  });
  it('does not restart on rerender and restores on unmount', async () => {
    const { animate, stop } = setup(false);
    const { rerender, unmount } = render(<HalloweenMummy />);
    rerender(<HalloweenMummy />);
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('does not borrow after unmounting before the lazy selector loads', async () => {
    const { animate, find } = setup(false);
    const { unmount } = render(<HalloweenMummy />);
    unmount();
    await act(async () => {
      await import('@epam/ai-dial-conversation-input');
    });
    expect(find).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });
  it('falls back to artwork when the composer is unavailable', async () => {
    const { find, animate } = setup(false);
    find.mockReturnValue(null);
    render(<HalloweenMummy />);
    await waitFor(() => expect(find).toHaveBeenCalledOnce());
    expect(animate).not.toHaveBeenCalled();
  });
});
