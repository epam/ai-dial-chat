/* Decorative SVG has no accessible role; these structural queries inspect inert art. */
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
import { animateFootprints } from '../../../utils/halloween-footprint-animation';
import { getFootprintTargets } from '../../../utils/halloween-footprint-targets';
import HalloweenFootprints from '../HalloweenFootprints';

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
    const anchors = testAnchors({
      composer: 'composer',
      starterList: 'starters',
    });
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
vi.mock('../../../utils/halloween-footprint-animation', () => ({
  animateFootprints: vi.fn(),
}));
vi.mock('../../../utils/halloween-footprint-targets', () => ({
  getFootprintTargets: vi.fn(),
}));
const descriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const stop = vi.fn();
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
  vi.mocked(animateFootprints).mockReturnValue(stop);
  vi.mocked(getFootprintTargets).mockReturnValue({
    width: 1280,
    height: 800,
  });
});
afterEach(() => {
  if (descriptor)
    Object.defineProperty(Element.prototype, 'animate', descriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('invisible cat scene integration', () => {
  it('renders a content-free input outline with shared contact geometry', async () => {
    const composer = document.createElement('div');
    composer.innerHTML = '<textarea>Private draft</textarea>';
    vi.mocked(getFootprintTargets).mockReturnValue({
      width: 1280,
      height: 800,
      composer: {
        element: composer,
        rect: new DOMRect(400, 300, 500, 150),
        borderRadius: '12px',
      },
    });
    const view = render(<HalloweenFootprints />);
    await waitFor(() => expect(animateFootprints).toHaveBeenCalledOnce());
    const outline = view.container.querySelector<HTMLElement>(
      '[data-footprint-ledge]',
    );
    expect(outline).not.toBeNull();
    expect(outline!.style.borderRadius).toBe('12px');
    expect(outline!.children).toHaveLength(0);
    expect(view.container.querySelector('textarea')).toBeNull();
    expect(vi.mocked(animateFootprints).mock.calls[0][1].surface).toBe(
      outline!.parentElement,
    );
    expect(
      view.container.querySelectorAll('svg, svg *').length,
    ).toBeLessThanOrEqual(110);
  });
  it.each([true, false])(
    'connects a bounded invisible cat without changing input, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(
        <>
          <textarea aria-label="Message" defaultValue="Draft" />
          <HalloweenFootprints />
        </>,
      );
      await waitFor(() => expect(animateFootprints).toHaveBeenCalledOnce());
      const [plan, elements] = vi.mocked(animateFootprints).mock.calls[0];
      expect(plan.prints).toHaveLength(mobile ? 8 : 12);
      expect(elements.prints).toHaveLength(plan.prints.length);
      expect(
        view.container.querySelectorAll('svg, svg *').length,
      ).toBeLessThanOrEqual(mobile ? 80 : 110);
      const paths = new Set(
        Array.from(
          view.container.querySelectorAll('path'),
          (path) => path.getAttribute('d') ?? '',
        ),
      );
      expect([...paths].join('').length).toBeLessThan(2048);
      expect(
        view.container.querySelector('filter, mask, image, foreignObject'),
      ).toBeNull();
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty(
        'value',
        'Draft',
      );
      expect(
        view.container
          .querySelector('[data-halloween-scene="footprints"]')
          ?.hasAttribute('inert'),
      ).toBe(true);
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );
  it.each(['reduced', 'unsupported', 'noResizeObserver'])(
    'uses static art without geometry or animation when %s',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'unsupported')
        Reflect.deleteProperty(Element.prototype, 'animate');
      if (mode === 'noResizeObserver')
        vi.stubGlobal('ResizeObserver', undefined);
      const view = render(<HalloweenFootprints />);
      expect(
        view.container.querySelector('[data-footprint-static]'),
      ).not.toBeNull();
      expect(view.container.querySelectorAll('svg')).toHaveLength(4);
      expect(getFootprintTargets).not.toHaveBeenCalled();
      expect(animateFootprints).not.toHaveBeenCalled();
    },
  );
  it('does not start deferred work after immediate interaction', async () => {
    render(<HalloweenFootprints />);
    fireEvent.keyDown(window, { key: 'a' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getFootprintTargets).not.toHaveBeenCalled();
    expect(animateFootprints).not.toHaveBeenCalled();
  });
  it('prepares once through StrictMode rehearsal and cancels a motion change', async () => {
    const view = render(
      <StrictMode>
        <HalloweenFootprints />
      </StrictMode>,
    );
    await waitFor(() => expect(animateFootprints).toHaveBeenCalledOnce());
    expect(getFootprintTargets).toHaveBeenCalledOnce();
    act(() => {
      state.reduced = true;
      state.listeners.forEach((listener) => listener());
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-ended="true"]')).not.toBeNull();
  });
  it('stops instead of rebuilding the route when the host changes layout bands', async () => {
    const view = render(<HalloweenFootprints />);
    await waitFor(() => expect(animateFootprints).toHaveBeenCalledOnce());
    state.mobile = true;
    view.rerender(<HalloweenFootprints />);
    expect(stop).toHaveBeenCalledOnce();
    expect(getFootprintTargets).toHaveBeenCalledOnce();
    expect(view.container.querySelector('[data-ended="true"]')).not.toBeNull();
  });
  it('drops deferred preparation after unmount', async () => {
    const view = render(<HalloweenFootprints />);
    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(getFootprintTargets).not.toHaveBeenCalled();
    expect(animateFootprints).not.toHaveBeenCalled();
  });
});
