import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateCat } from '../../../utils/halloween-cat-animation';
import { buildCatPlan } from '../../../utils/halloween-cat-plan';
import { getCatTargets } from '../../../utils/halloween-cat-targets';
import HalloweenCatScene from '../HalloweenCatScene';

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
vi.mock('../../../utils/halloween-cat-animation', () => ({
  animateCat: vi.fn(),
}));
vi.mock('../../../utils/halloween-cat-plan', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../utils/halloween-cat-plan')>();
  return { ...original, buildCatPlan: vi.fn(original.buildCatPlan) };
});
vi.mock('../../../utils/halloween-cat-targets', () => ({
  getCatTargets: vi.fn(),
}));

const stop = vi.fn();
const decorativeElements = (root: Element | null, selector: string) => {
  /* Inert illustration parts have no accessible roles to query. */
  // eslint-disable-next-line testing-library/no-node-access
  return root ? Array.from(root.querySelectorAll<Element>(selector)) : [];
};
const animateDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildCatPlan).mockReset();
  state.mobile = false;
  state.reduced = false;
  state.listeners.clear();
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  vi.mocked(animateCat).mockReturnValue(stop);
  vi.mocked(getCatTargets).mockReturnValue({
    width: 1280,
    height: 900,
    composer: {
      element: document.createElement('section'),
      rect: new DOMRect(420, 420, 540, 100),
    },
    buttons: [
      {
        element: document.createElement('button'),
        rect: new DOMRect(440, 470, 40, 40),
      },
      {
        element: document.createElement('button'),
        rect: new DOMRect(492, 470, 40, 40),
      },
    ],
    supports: [],
  });
});

afterEach(() => {
  if (animateDescriptor)
    Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
  vi.restoreAllMocks();
});

describe('cat scene integration', () => {
  it.each([true, false])(
    'connects articulated artwork without disturbing the focused draft, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(
        <textarea aria-label="Message" defaultValue="My draft text" />,
      );
      const input = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Message',
      });
      input.focus();
      input.setSelectionRange(3, 8, 'backward');
      view.rerender(
        <>
          <textarea aria-label="Message" defaultValue="My draft text" />
          <HalloweenCatScene />
        </>,
      );
      await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
      const [, elements] = vi.mocked(animateCat).mock.calls[0];
      expect(getCatTargets).toHaveBeenCalledWith(
        expect.objectContaining({
          composer: 'composer',
          starterList: 'starters',
        }),
      );
      expect(buildCatPlan).toHaveBeenCalledWith(
        vi.mocked(getCatTargets).mock.results[0].value,
        mobile,
      );
      expect(elements.host.getAttribute('aria-hidden')).toBe('true');
      expect(elements.host.hasAttribute('inert')).toBe(true);
      expect(elements.host.getAttribute('data-ready')).toBe('true');
      expect(
        decorativeElements(elements.actor, '[data-cat-part]'),
      ).toHaveLength(10);
      expect(
        decorativeElements(
          elements.actor,
          '[data-cat-part="arm"] [data-cat-part="forearm"]',
        ),
      ).toHaveLength(1);
      const paw = decorativeElements(elements.actor, '[data-cat-paw]')[0];
      expect([paw.getAttribute('cx'), paw.getAttribute('cy')]).toEqual([
        '100',
        '120',
      ]);
      expect(
        decorativeElements(elements.actor, 'svg')[0].getAttribute('viewBox'),
      ).toBe('0 0 160 140');
      expect(input.matches(':focus')).toBe(true);
      expect(input.value).toBe('My draft text');
      expect([
        input.selectionStart,
        input.selectionEnd,
        input.selectionDirection,
      ]).toEqual([3, 8, 'backward']);
      expect(screen.queryByRole('img')).toBeNull();
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );

  it('preserves its single measured plan across ancestor rerenders', async () => {
    const view = render(<HalloweenCatScene />);
    await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
    view.rerender(<HalloweenCatScene />);
    expect(animateCat).toHaveBeenCalledOnce();
    expect(buildCatPlan).toHaveBeenCalledOnce();
    expect(getCatTargets).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it('waits for target discovery before showing the decorative fallback', async () => {
    vi.mocked(getCatTargets).mockReturnValue({
      width: 1280,
      height: 900,
      buttons: [],
      supports: [],
    });
    const view = render(<HalloweenCatScene />);
    expect(
      decorativeElements(view.container, '[data-cat-fallback]'),
    ).toHaveLength(0);
    await waitFor(() => expect(buildCatPlan).toHaveBeenCalledOnce());
    expect(animateCat).not.toHaveBeenCalled();
    expect(
      decorativeElements(view.container, '[data-cat-fallback]'),
    ).toHaveLength(1);
    expect(
      decorativeElements(view.container, '[data-cat-fallback] svg'),
    ).toHaveLength(1);
    expect(
      decorativeElements(view.container, '[data-stationary="false"]'),
    ).toHaveLength(1);
  });

  it.each(['reduced motion', 'unsupported WAAPI'])(
    'shows a stationary cat without measuring or borrowing the page under %s',
    async (condition) => {
      if (condition === 'reduced motion') state.reduced = true;
      else Reflect.deleteProperty(Element.prototype, 'animate');
      const view = render(<HalloweenCatScene />);
      await act(async () => undefined);
      expect(getCatTargets).not.toHaveBeenCalled();
      expect(buildCatPlan).not.toHaveBeenCalled();
      expect(animateCat).not.toHaveBeenCalled();
      expect(
        decorativeElements(
          view.container,
          '[data-stationary="true"][data-ready="true"]',
        ),
      ).toHaveLength(1);
      expect(
        decorativeElements(view.container, '[data-cat-fallback] svg'),
      ).toHaveLength(1);
    },
  );

  it('stays stopped after a breakpoint change and return', async () => {
    const view = render(<HalloweenCatScene />);
    await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
    state.mobile = true;
    view.rerender(<HalloweenCatScene />);
    expect(stop).toHaveBeenCalledOnce();
    state.mobile = false;
    view.rerender(<HalloweenCatScene />);
    await act(async () => undefined);
    expect(animateCat).toHaveBeenCalledOnce();
    expect(getCatTargets).toHaveBeenCalledOnce();
    expect(
      decorativeElements(view.container, '[data-ended="true"]'),
    ).toHaveLength(1);
  });

  it('restores and never restarts after reduced motion changes twice', async () => {
    render(<HalloweenCatScene />);
    await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
    act(() => {
      state.reduced = true;
      state.listeners.forEach((listener) => listener());
    });
    expect(stop).toHaveBeenCalledOnce();
    act(() => {
      state.reduced = false;
      state.listeners.forEach((listener) => listener());
    });
    await act(async () => undefined);
    expect(animateCat).toHaveBeenCalledOnce();
    expect(getCatTargets).toHaveBeenCalledOnce();
  });

  it('cannot turn a stationary activation into a moving one', async () => {
    state.reduced = true;
    render(<HalloweenCatScene />);
    act(() => {
      state.reduced = false;
      state.listeners.forEach((listener) => listener());
    });
    await act(async () => undefined);
    expect(getCatTargets).not.toHaveBeenCalled();
    expect(animateCat).not.toHaveBeenCalled();
  });

  it('ends on controller completion without restarting after rerender', async () => {
    const view = render(<HalloweenCatScene />);
    await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
    act(() => vi.mocked(animateCat).mock.calls[0][2]());
    view.rerender(<HalloweenCatScene />);
    expect(stop).toHaveBeenCalledOnce();
    expect(animateCat).toHaveBeenCalledOnce();
    expect(
      decorativeElements(view.container, '[data-ended="true"]'),
    ).toHaveLength(1);
  });

  it.each([
    'pointerdown',
    'keydown',
    'focusin',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'resize',
  ])('stops on %s and cannot restart', async (event) => {
    const view = render(<HalloweenCatScene />);
    await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
    fireEvent(window, new Event(event));
    expect(stop).toHaveBeenCalledOnce();
    view.rerender(<HalloweenCatScene />);
    expect(animateCat).toHaveBeenCalledOnce();
  });

  it('ignores scroll restoration inside its copy host', async () => {
    render(<HalloweenCatScene />);
    await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
    const { copies } = vi.mocked(animateCat).mock.calls[0][1];
    fireEvent.scroll(copies);
    expect(stop).not.toHaveBeenCalled();
  });

  it('cancels deferred discovery when the document is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    render(<HalloweenCatScene />);
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => undefined);
    expect(getCatTargets).not.toHaveBeenCalled();
    expect(animateCat).not.toHaveBeenCalled();
  });

  it('cancels interaction before deferred imports resolve', async () => {
    render(<HalloweenCatScene />);
    fireEvent.pointerDown(window);
    await act(async () => undefined);
    expect(getCatTargets).not.toHaveBeenCalled();
    expect(animateCat).not.toHaveBeenCalled();
  });

  it('does not measure or animate after unmount during preparation', async () => {
    const view = render(<HalloweenCatScene />);
    view.unmount();
    await act(async () => undefined);
    expect(getCatTargets).not.toHaveBeenCalled();
    expect(animateCat).not.toHaveBeenCalled();
  });

  it('disposes StrictMode rehearsal before creating the real scene', async () => {
    const view = render(
      <StrictMode>
        <HalloweenCatScene />
      </StrictMode>,
    );
    await waitFor(() => expect(animateCat).toHaveBeenCalledOnce());
    expect(getCatTargets).toHaveBeenCalledOnce();
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
