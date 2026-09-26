import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HalloweenWebScene from '../HalloweenWebScene';

const mocks = vi.hoisted(() => ({
  mobile: false,
  reduced: false,
  stop: vi.fn(),
  animate: vi.fn(),
  targets: vi.fn(),
  build: vi.fn(),
  listeners: new Set<() => void>(),
}));
vi.mock(
  '../../../../context/CelebrationEnvironmentContext',
  async (importOriginal) => {
    const { testAnchors, testEnvironment } =
      await import('../../../../test-utils/environment');
    /* One anchors object for the whole file, as the provider memoizes it. */
    const anchors = testAnchors({
      composer: 'composer',
      composerModelSelector: 'model',
      composerAddCluster: 'add',
    });
    return {
      ...(await importOriginal<
        typeof import('../../../../context/CelebrationEnvironmentContext')
      >()),
      useCelebrationEnvironment: () =>
        testEnvironment({ isMobile: mocks.mobile, anchors }),
    };
  },
);
vi.mock('../../../../hooks/useReducedMotion', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useReducedMotion: () =>
      useSyncExternalStore(
        (listener) => {
          mocks.listeners.add(listener);
          return () => mocks.listeners.delete(listener);
        },
        () => mocks.reduced,
      ),
  };
});
vi.mock('../../../utils/halloween-web-animation', () => ({
  animateHalloweenWeb: mocks.animate,
}));
vi.mock('../../../utils/halloween-web-plan', () => ({
  buildHalloweenWebPlan: mocks.build,
}));
vi.mock('../../../utils/halloween-web-targets', () => ({
  getHalloweenWebTargets: mocks.targets,
}));

describe('HalloweenWebScene', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.mobile = false;
    mocks.reduced = false;
    mocks.animate.mockReturnValue(mocks.stop);
    mocks.targets.mockReturnValue([
      { left: 24, top: 60, width: 200, height: 40 },
    ]);
    mocks.build.mockImplementation(({ width, height }) => ({
      width,
      height,
      webs: [],
      strands: [],
    }));
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('uses visible UI rectangles while leaving existing controls and focus intact', async () => {
    const view = render(
      <>
        <input aria-label="Chat message" />
        <HalloweenWebScene />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Chat message' });
    input.focus();
    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(1));
    expect(mocks.build).toHaveBeenCalledWith({
      width: 1280,
      height: 800,
      isMobile: false,
      targets: mocks.targets.mock.results[0].value,
    });
    expect(input.matches(':focus')).toBe(true);
    expect(screen.queryByRole('img')).toBeNull();
    const canvas = mocks.animate.mock.calls[0][0] as HTMLCanvasElement;
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    view.unmount();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it('does not restart or measure again when an ancestor rerenders', async () => {
    const view = render(<HalloweenWebScene />);
    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(1));
    view.rerender(<HalloweenWebScene />);
    expect(mocks.targets).toHaveBeenCalledTimes(1);
    expect(mocks.build).toHaveBeenCalledTimes(1);
    expect(mocks.stop).not.toHaveBeenCalled();
  });

  it('stops motion and paints the same plan when reduced motion changes live', async () => {
    const view = render(<HalloweenWebScene />);
    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(1));
    const plan = mocks.animate.mock.calls[0][1];
    act(() => {
      mocks.reduced = true;
      mocks.listeners.forEach((listener) => listener());
    });
    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(2));
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.build).toHaveBeenCalledTimes(1);
    expect(mocks.animate.mock.calls[1][1]).toBe(plan);
    expect(mocks.animate.mock.calls[1][2]).toMatchObject({
      reducedMotion: true,
    });
    view.unmount();
    expect(mocks.stop).toHaveBeenCalledTimes(2);
  });

  it('uses the mobile plan and an empty target list when the interface has no anchors', async () => {
    mocks.mobile = true;
    mocks.reduced = true;
    mocks.targets.mockReturnValue([]);
    render(<HalloweenWebScene />);
    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(1));
    expect(mocks.build).toHaveBeenCalledWith(
      expect.objectContaining({ isMobile: true, targets: [] }),
    );
    expect(mocks.animate.mock.calls[0][2]).toMatchObject({
      reducedMotion: true,
    });
  });

  it('refreshes anchors that moved before a motion preference change', async () => {
    render(<HalloweenWebScene />);
    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(1));
    const movedTargets = [{ left: 24, top: 120, width: 200, height: 40 }];
    mocks.targets.mockReturnValue(movedTargets);
    act(() => {
      mocks.reduced = true;
      mocks.listeners.forEach((listener) => listener());
    });
    await waitFor(() => expect(mocks.animate).toHaveBeenCalledTimes(2));
    expect(mocks.build).toHaveBeenCalledTimes(2);
    expect(mocks.build).toHaveBeenLastCalledWith(
      expect.objectContaining({ targets: movedTargets }),
    );
    expect(mocks.animate.mock.calls[1][1]).not.toBe(
      mocks.animate.mock.calls[0][1],
    );
  });

  it('does not start deferred preparation after unmount', async () => {
    const view = render(<HalloweenWebScene />);
    view.unmount();
    await act(async () => undefined);
    expect(mocks.targets).not.toHaveBeenCalled();
    expect(mocks.animate).not.toHaveBeenCalled();
  });
});
