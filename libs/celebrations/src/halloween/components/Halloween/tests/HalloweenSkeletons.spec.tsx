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
import { animateSkeletons } from '../../../utils/halloween-skeleton-animation';
import { getSkeletonTargets } from '../../../utils/halloween-skeleton-targets';
import HalloweenSkeletons from '../HalloweenSkeletons';
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
vi.mock('../../../utils/halloween-skeleton-animation', () => ({
  animateSkeletons: vi.fn(),
}));
vi.mock('../../../utils/halloween-skeleton-targets', () => ({
  getSkeletonTargets: vi.fn(),
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
  vi.mocked(animateSkeletons).mockReturnValue(stop);
  vi.mocked(getSkeletonTargets).mockReturnValue({
    width: 1280,
    height: 900,
    rtl: false,
    composer: {
      element: document.createElement('div'),
      rect: new DOMRect(340, 720, 600, 120),
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (descriptor)
    Object.defineProperty(Element.prototype, 'animate', descriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
});
describe('HalloweenSkeletons', () => {
  it.each([true, false])(
    'renders the bounded cast and composer outline without changing input, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(
        <>
          <textarea aria-label="Draft" defaultValue="Private" />
          <HalloweenSkeletons />
        </>,
      );
      await waitFor(() => expect(animateSkeletons).toHaveBeenCalledOnce());
      expect(
        view.container.querySelectorAll('[data-skeleton-art="showman"]'),
      ).toHaveLength(1);
      expect(
        view.container.querySelectorAll('[data-skeleton-art="partner"]'),
      ).toHaveLength(1);
      expect(
        view.container.querySelectorAll('[data-skeleton-free-skull-art]'),
      ).toHaveLength(1);
      expect(
        view.container.querySelector('[data-skeleton-ledge]'),
      ).not.toBeNull();
      expect(
        view.container.querySelectorAll('svg,svg *').length,
      ).toBeLessThanOrEqual(100);
      expect(
        view.container.querySelector('filter,mask,image,foreignObject'),
      ).toBeNull();
      expect(
        new Set(
          [...view.container.querySelectorAll('linearGradient')].map(
            (g) => g.id,
          ),
        ).size,
      ).toBe(3);
      expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveProperty(
        'value',
        'Private',
      );
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );
  it('renders an unmirrored copy of the greeting word in RTL', async () => {
    vi.mocked(getSkeletonTargets).mockReturnValue({
      width: 1280,
      height: 900,
      rtl: true,
      composer: {
        element: document.createElement('div'),
        rect: new DOMRect(340, 720, 600, 120),
      },
      word: {
        heading: document.createElement('h1'),
        headingRect: new DOMRect(500, 560, 280, 44),
        range: document.createRange(),
        rect: new DOMRect(560, 590, 90, 40),
        text: 'Valery',
        font: {
          fontFamily: 'Inter',
          fontSize: '32px',
          fontWeight: '600',
          fontStyle: 'normal',
          letterSpacing: 'normal',
          color: 'rgb(1, 2, 3)',
          textTransform: 'none',
        },
      },
    });
    const view = render(<HalloweenSkeletons />);
    await waitFor(() => expect(animateSkeletons).toHaveBeenCalledOnce());
    const copy = view.container.querySelector<HTMLElement>(
      '[data-skeleton-word]',
    )!;
    expect(copy.textContent).toBe('Valery');
    expect(copy.style.fontSize).toBe('32px');
    expect(copy.style.color).toBe('rgb(1, 2, 3)');
    expect(copy.querySelector<HTMLElement>('span')!.style.transform).toBe(
      'scaleX(-1)',
    );
  });

  it('mirrors only the artwork layer in RTL', async () => {
    vi.mocked(getSkeletonTargets).mockReturnValue({
      width: 1280,
      height: 900,
      rtl: true,
    });
    const view = render(<HalloweenSkeletons />);
    await waitFor(() => expect(animateSkeletons).toHaveBeenCalledOnce());
    const layer = view.container.querySelector<HTMLElement>(
      '[data-halloween-scene="skeletons"]',
    )!;
    expect(layer.style.transform).toBe('scaleX(-1)');
    expect(view.container.querySelector('[data-skeleton-ledge]')).toBeNull();
  });
  it.each(['reduced', 'unsupported', 'noResizeObserver'])(
    'uses a static composition without measurements in %s mode',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'unsupported')
        Reflect.deleteProperty(Element.prototype, 'animate');
      if (mode === 'noResizeObserver')
        vi.stubGlobal('ResizeObserver', undefined);
      const view = render(<HalloweenSkeletons />);
      expect(
        view.container.querySelector('[data-skeleton-static]'),
      ).not.toBeNull();
      expect(getSkeletonTargets).not.toHaveBeenCalled();
      expect(animateSkeletons).not.toHaveBeenCalled();
    },
  );
  it('prepares once in StrictMode and releases playback on motion change', async () => {
    const view = render(
      <StrictMode>
        <HalloweenSkeletons />
      </StrictMode>,
    );
    await waitFor(() => expect(animateSkeletons).toHaveBeenCalledOnce());
    expect(getSkeletonTargets).toHaveBeenCalledOnce();
    act(() => {
      state.reduced = true;
      state.listeners.forEach((l) => l());
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-ended="true"]')).not.toBeNull();
  });
  it('cannot restart preparation interrupted by typing', async () => {
    render(<HalloweenSkeletons />);
    fireEvent.keyDown(window, { key: 'a' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getSkeletonTargets).not.toHaveBeenCalled();
    expect(animateSkeletons).not.toHaveBeenCalled();
  });
  it('drops pending preparation after unmount', async () => {
    const view = render(<HalloweenSkeletons />);
    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(getSkeletonTargets).not.toHaveBeenCalled();
  });
  it('cancels instead of rebuilding when the host changes its mobile mode', async () => {
    const view = render(<HalloweenSkeletons />);
    await waitFor(() => expect(animateSkeletons).toHaveBeenCalledOnce());
    state.mobile = true;
    view.rerender(<HalloweenSkeletons />);
    expect(stop).toHaveBeenCalledOnce();
    expect(getSkeletonTargets).toHaveBeenCalledOnce();
  });
});
