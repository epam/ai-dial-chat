import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateRavens } from '../../../utils/halloween-raven-animation';
import { getRavenTargets } from '../../../utils/halloween-raven-targets';
import HalloweenRavens from '../HalloweenRavens';

const state = vi.hoisted(() => ({
  mobile: false,
  reduced: false,
  listeners: new Set<() => void>(),
}));
vi.mock(
  '../../../../context/CelebrationEnvironmentContext',
  async (importOriginal) => {
    const { testAnchors, testEnvironment } =
      await import('../../../../test-utils/environment');
    /* One anchors object for the whole file, as the provider memoizes it. */
    const anchors = testAnchors({ composer: 'composer' });
    return {
      ...(await importOriginal<
        typeof import('../../../../context/CelebrationEnvironmentContext')
      >()),
      useCelebrationEnvironment: () =>
        testEnvironment({ isMobile: state.mobile, anchors }),
    };
  },
);
vi.mock('../../../../hooks/useReducedMotion', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useReducedMotion: () =>
      useSyncExternalStore(
        (listener) => {
          state.listeners.add(listener);
          return () => state.listeners.delete(listener);
        },
        () => state.reduced,
      ),
  };
});
vi.mock('../../../utils/halloween-raven-animation', () => ({
  animateRavens: vi.fn(),
}));
vi.mock('../../../utils/halloween-raven-targets', () => ({
  getRavenTargets: vi.fn(),
}));
const stop = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  state.mobile = false;
  state.reduced = false;
  state.listeners.clear();
  vi.mocked(animateRavens).mockReturnValue(stop);
  vi.mocked(getRavenTargets).mockReturnValue({
    width: 1280,
    height: 800,
    pumpkin: null,
    composer: null,
    conversation: null,
    fragments: [],
    edges: [],
  });
});
afterEach(() => vi.restoreAllMocks());

describe('raven scene integration', () => {
  it.each([true, false])(
    'supplies one plan with the correct actor budget, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(
        <>
          <input aria-label="Message" />
          <HalloweenRavens />
        </>,
      );
      const input = screen.getByRole('textbox', { name: 'Message' });
      input.focus();
      await waitFor(() => expect(animateRavens).toHaveBeenCalledOnce());
      const [plan, elements] = vi.mocked(animateRavens).mock.calls[0];
      expect(plan.birds).toHaveLength(mobile ? 5 : 8);
      expect(elements.birds).toHaveLength(plan.birds.length);
      expect(elements.host.getAttribute('aria-hidden')).toBe('true');
      expect(getRavenTargets).toHaveBeenCalledWith(
        expect.objectContaining({ composer: 'composer' }),
      );
      expect(input.matches(':focus')).toBe(true);
      expect(screen.queryByRole('img')).toBeNull();
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );

  it('does not restart the story when an ancestor rerenders', async () => {
    const view = render(<HalloweenRavens />);
    await waitFor(() => expect(animateRavens).toHaveBeenCalledOnce());
    view.rerender(<HalloweenRavens />);
    expect(animateRavens).toHaveBeenCalledOnce();
    expect(getRavenTargets).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it('shows only static artwork under reduced motion', async () => {
    state.reduced = true;
    render(<HalloweenRavens />);
    await waitFor(() => expect(getRavenTargets).toHaveBeenCalledOnce());
    expect(animateRavens).not.toHaveBeenCalled();
  });

  it('does not restart after resizing across the mobile breakpoint and back', async () => {
    const view = render(<HalloweenRavens />);
    await waitFor(() => expect(animateRavens).toHaveBeenCalledOnce());
    state.mobile = true;
    view.rerender(<HalloweenRavens />);
    await waitFor(() => expect(getRavenTargets).toHaveBeenCalledTimes(2));
    expect(stop).toHaveBeenCalledOnce();
    expect(animateRavens).toHaveBeenCalledOnce();
    state.mobile = false;
    view.rerender(<HalloweenRavens />);
    await waitFor(() => expect(getRavenTargets).toHaveBeenCalledTimes(3));
    expect(animateRavens).toHaveBeenCalledOnce();
  });

  it('keeps a canceled scene stopped when its configuration changes', async () => {
    const view = render(<HalloweenRavens />);
    await waitFor(() => expect(animateRavens).toHaveBeenCalledOnce());
    act(() => vi.mocked(animateRavens).mock.calls[0][2]());
    state.mobile = true;
    view.rerender(<HalloweenRavens />);
    await waitFor(() => expect(getRavenTargets).toHaveBeenCalledTimes(2));
    expect(animateRavens).toHaveBeenCalledOnce();
  });

  it('restores borrowed UI when the motion preference changes live', async () => {
    render(<HalloweenRavens />);
    await waitFor(() => expect(animateRavens).toHaveBeenCalledOnce());
    act(() => {
      state.reduced = true;
      state.listeners.forEach((listener) => listener());
    });
    expect(stop).toHaveBeenCalledOnce();
    await waitFor(() => expect(getRavenTargets).toHaveBeenCalledTimes(2));
    expect(animateRavens).toHaveBeenCalledOnce();
    act(() => {
      state.reduced = false;
      state.listeners.forEach((listener) => listener());
    });
    expect(animateRavens).toHaveBeenCalledOnce();
    await waitFor(() => expect(animateRavens).toHaveBeenCalledTimes(2));
    expect(getRavenTargets).toHaveBeenCalledTimes(3);
  });

  it('does not measure or start a deferred scene after unmount', async () => {
    const view = render(<HalloweenRavens />);
    view.unmount();
    await act(async () => undefined);
    expect(getRavenTargets).not.toHaveBeenCalled();
    expect(animateRavens).not.toHaveBeenCalled();
  });
});
