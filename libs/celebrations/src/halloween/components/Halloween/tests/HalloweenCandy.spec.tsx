/* The deliberately inert illustration has no accessible controls to query. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateCandy } from '../../../utils/halloween-candy-animation';
import { getCandyTargets } from '../../../utils/halloween-candy-targets';
import HalloweenCandy from '../HalloweenCandy';
const state = vi.hoisted(() => ({
  mobile: false,
  reduced: false,
  listeners: new Set<() => void>(),
}));
vi.mock('../../../../context/CelebrationEnvironmentContext', async () => {
  const { testEnvironment, testAnchors } =
    await import('../../../../test-utils/environment');
  const anchors = testAnchors({});
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({ isMobile: state.mobile, anchors }),
  };
});
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
vi.mock('../../../utils/halloween-candy-animation', () => ({
  animateCandy: vi.fn(),
}));
vi.mock('../../../utils/halloween-candy-targets', () => ({
  getCandyTargets: vi.fn(),
}));
const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  ),
  stop = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  state.mobile = false;
  state.reduced = false;
  state.listeners.clear();
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal('ResizeObserver', class {});
  vi.mocked(animateCandy).mockReturnValue(stop);
  vi.mocked(getCandyTargets).mockReturnValue({
    width: 1280,
    height: 900,
    rtl: false,
    surfaces: [],
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (descriptor)
    Object.defineProperty(Element.prototype, 'animate', descriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
});
describe('Candy battle integration', () => {
  it.each([true, false])(
    'renders the complete bounded cast without changing input, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(
        <>
          <textarea aria-label="Draft" defaultValue="Private" />
          <HalloweenCandy />
        </>,
      );
      await waitFor(() => expect(animateCandy).toHaveBeenCalledOnce());
      expect(
        view.container.querySelectorAll('[data-candy-sweet]'),
      ).toHaveLength(mobile ? 12 : 18);
      expect(view.container.querySelectorAll('[data-candy-bird]')).toHaveLength(
        mobile ? 4 : 6,
      );
      expect(
        view.container.querySelectorAll('[data-candy-janitor-art="mummy"]'),
      ).toHaveLength(1);
      expect(
        view.container.querySelectorAll('[data-candy-janitor-art="skeleton"]'),
      ).toHaveLength(2);
      expect(
        view.container.querySelectorAll('svg,svg *').length,
      ).toBeLessThanOrEqual(mobile ? 400 : 520);
      expect(
        view.container.querySelector('filter,mask,image,foreignObject'),
      ).toBeNull();
      expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveProperty(
        'value',
        'Private',
      );
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );
  it.each(['reduced', 'unsupported', 'noResizeObserver'])(
    'uses static art without measurements in %s mode',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'unsupported')
        Reflect.deleteProperty(Element.prototype, 'animate');
      if (mode === 'noResizeObserver')
        vi.stubGlobal('ResizeObserver', undefined);
      const view = render(<HalloweenCandy />);
      expect(
        view.container.querySelector('[data-candy-static]'),
      ).not.toBeNull();
      expect(getCandyTargets).not.toHaveBeenCalled();
      expect(animateCandy).not.toHaveBeenCalled();
    },
  );
  it('prepares once in StrictMode and releases playback on motion change', async () => {
    const view = render(
      <StrictMode>
        <HalloweenCandy />
      </StrictMode>,
    );
    await waitFor(() => expect(animateCandy).toHaveBeenCalledOnce());
    expect(getCandyTargets).toHaveBeenCalledOnce();
    act(() => {
      state.reduced = true;
      state.listeners.forEach((l) => l());
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-ended="true"]')).not.toBeNull();
  });
  it('cannot restart preparation interrupted by typing', async () => {
    render(<HalloweenCandy />);
    fireEvent.keyDown(window, { key: 'a' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getCandyTargets).not.toHaveBeenCalled();
    expect(animateCandy).not.toHaveBeenCalled();
  });
  it('drops pending preparation after unmount', async () => {
    const view = render(<HalloweenCandy />);
    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(getCandyTargets).not.toHaveBeenCalled();
  });
  it('cancels instead of rebuilding when the host changes its mobile mode', async () => {
    const view = render(<HalloweenCandy />);
    await waitFor(() => expect(animateCandy).toHaveBeenCalledOnce());
    state.mobile = true;
    view.rerender(<HalloweenCandy />);
    expect(stop).toHaveBeenCalledOnce();
    expect(getCandyTargets).toHaveBeenCalledOnce();
  });
});
