import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateBats } from '../../../utils/halloween-bat-animation';
import { BatPart, buildBatPlan } from '../../../utils/halloween-bat-plan';
import { getBatTargets } from '../../../utils/halloween-bat-targets';
import HalloweenBats from '../HalloweenBats';

const state = vi.hoisted(() => ({
  mobile: false,
  reduced: false,
  listeners: new Set<() => void>(),
}));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => state.mobile,
}));
vi.mock('../../../hooks/celebration/useReducedMotion', async () => {
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
vi.mock('@epam/ai-dial-conversation-input', () => ({
  CONVERSATION_INPUT_CLASS: { wrapper: 'composer' },
}));
vi.mock('@epam/ai-dial-starter-buttons', () => ({
  STARTER_BUTTONS_CLASS: { list: 'starters' },
}));
vi.mock('../../../utils/halloween-bat-animation', () => ({
  animateBats: vi.fn(),
}));
vi.mock('../../../utils/halloween-bat-plan', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../../utils/halloween-bat-plan')
  >()),
  buildBatPlan: vi.fn(),
}));
vi.mock('../../../utils/halloween-bat-targets', () => ({
  getBatTargets: vi.fn(),
}));

const stop = vi.fn();
const decorativeElements = (root: Element | null, selector: string) => {
  /* These inert illustrations deliberately have no accessible roles. */
  // eslint-disable-next-line testing-library/no-node-access
  return root ? Array.from(root.querySelectorAll<Element>(selector)) : [];
};
const animateDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);

beforeEach(() => {
  vi.clearAllMocks();
  state.mobile = false;
  state.reduced = false;
  state.listeners.clear();
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  vi.mocked(animateBats).mockReturnValue(stop);
  vi.mocked(getBatTargets).mockReturnValue({
    width: 1280,
    height: 800,
    surfaces: [],
  });
  vi.mocked(buildBatPlan).mockImplementation((targets) => ({
    active: true,
    width: targets.width,
    height: targets.height,
    surfaces: [],
    actors: Array.from({ length: 3 }, (_, index) => ({
      size: 80,
      sleeper: index === 0,
      rest: { x: 320 + index * 120, y: 360 },
      frames: [],
      parts: {
        [BatPart.WingLeft]: [],
        [BatPart.WingRight]: [],
        [BatPart.ForearmLeft]: [],
        [BatPart.ForearmRight]: [],
        [BatPart.Wrap]: [],
        [BatPart.Sleep]: [],
        [BatPart.Eye]: [],
        [BatPart.Yawn]: [],
        [BatPart.Gaze]: [],
      },
    })),
  }));
});

afterEach(() => {
  if (animateDescriptor)
    Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
  vi.restoreAllMocks();
});

describe('bat scene integration', () => {
  it.each([true, false])(
    'connects three articulated actors without beams or disturbing input, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(<input aria-label="Message" defaultValue="Draft" />);
      const input = screen.getByRole('textbox', { name: 'Message' });
      input.focus();
      view.rerender(
        <>
          <input aria-label="Message" defaultValue="Draft" />
          <HalloweenBats />
        </>,
      );
      await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
      const [, elements] = vi.mocked(animateBats).mock.calls[0];
      expect(elements.actors).toHaveLength(3);
      expect(getBatTargets).toHaveBeenCalledWith(
        'composer',
        'starters',
        mobile ? 3 : 5,
      );
      expect(buildBatPlan).toHaveBeenCalledWith(
        vi.mocked(getBatTargets).mock.results[0].value,
        mobile,
      );
      expect(elements.host.getAttribute('aria-hidden')).toBe('true');
      expect(elements.host.hasAttribute('inert')).toBe(true);
      expect(elements.host.getAttribute('data-ready')).toBe('true');
      for (const actor of elements.actors) {
        expect(decorativeElements(actor, '[data-bat-part]')).toHaveLength(9);
        expect(
          decorativeElements(
            actor,
            '[data-bat-part="wing-left"] [data-bat-part="forearm-left"]',
          ),
        ).toHaveLength(1);
        expect(
          decorativeElements(
            actor,
            '[data-bat-part="wing-right"] [data-bat-part="forearm-right"]',
          ),
        ).toHaveLength(1);
        expect(
          decorativeElements(actor, 'svg')[0].getAttribute('viewBox'),
        ).toBe('0 0 100 80');
      }
      expect(decorativeElements(elements.host, 'svg')).toHaveLength(3);
      expect(decorativeElements(elements.host, '[data-bat-gust]')).toHaveLength(
        0,
      );
      expect(elements.actors[0].getAttribute('data-bat-sleeper')).toBe('true');
      expect(elements.actors[1].getAttribute('data-bat-sleeper')).toBe('false');
      expect(input.matches(':focus')).toBe(true);
      expect((input as HTMLInputElement).value).toBe('Draft');
      expect(screen.queryByRole('img')).toBeNull();
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );

  it('keeps a single plan and actor references across ancestor rerenders', async () => {
    const view = render(<HalloweenBats />);
    await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
    view.rerender(<HalloweenBats />);
    expect(animateBats).toHaveBeenCalledOnce();
    expect(buildBatPlan).toHaveBeenCalledOnce();
    expect(getBatTargets).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it('defers the legacy flight until unavailable anchors are known', async () => {
    vi.mocked(buildBatPlan).mockReturnValue({
      active: false,
      width: 1280,
      height: 800,
      surfaces: [],
      actors: [],
    });
    const view = render(<HalloweenBats />);
    expect(
      decorativeElements(view.container, '[data-bat-fallback]'),
    ).toHaveLength(0);
    await waitFor(() => expect(buildBatPlan).toHaveBeenCalledOnce());
    expect(animateBats).not.toHaveBeenCalled();
    expect(
      decorativeElements(view.container, '[data-bat-fallback]'),
    ).toHaveLength(1);
    const flightNodes = decorativeElements(
      view.container,
      '[data-bat-fallback] span[style]',
    );
    expect(flightNodes).toHaveLength(16);
    const paths = flightNodes.map((flight) => flight.getAttribute('style'));
    view.rerender(<HalloweenBats />);
    expect(flightNodes.map((flight) => flight.getAttribute('style'))).toEqual(
      paths,
    );
    expect(
      decorativeElements(view.container, '[data-stationary="false"]'),
    ).toHaveLength(1);
  });

  it.each(['reduced motion', 'unsupported WAAPI'])(
    'renders stationary fallback without target measurement under %s',
    async (condition) => {
      if (condition === 'reduced motion') state.reduced = true;
      else Reflect.deleteProperty(Element.prototype, 'animate');
      const view = render(<HalloweenBats />);
      await act(async () => undefined);
      expect(getBatTargets).not.toHaveBeenCalled();
      expect(buildBatPlan).not.toHaveBeenCalled();
      expect(animateBats).not.toHaveBeenCalled();
      expect(
        decorativeElements(view.container, '[data-stationary="true"]'),
      ).toHaveLength(1);
      expect(
        decorativeElements(view.container, '[data-bat-fallback] span[style]'),
      ).toHaveLength(16);
    },
  );

  it('stays stopped after crossing a breakpoint and returning', async () => {
    const view = render(<HalloweenBats />);
    await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
    state.mobile = true;
    view.rerender(<HalloweenBats />);
    expect(stop).toHaveBeenCalledOnce();
    state.mobile = false;
    view.rerender(<HalloweenBats />);
    await act(async () => undefined);
    expect(animateBats).toHaveBeenCalledOnce();
    expect(getBatTargets).toHaveBeenCalledOnce();
    expect(
      decorativeElements(view.container, '[data-ended="true"]'),
    ).toHaveLength(1);
  });

  it('restores and never restarts when reduced motion is changed twice', async () => {
    render(<HalloweenBats />);
    await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
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
    expect(animateBats).toHaveBeenCalledOnce();
    expect(getBatTargets).toHaveBeenCalledOnce();
  });

  it('cannot turn a stationary activation into a moving scene', async () => {
    state.reduced = true;
    render(<HalloweenBats />);
    act(() => {
      state.reduced = false;
      state.listeners.forEach((listener) => listener());
    });
    await act(async () => undefined);
    expect(getBatTargets).not.toHaveBeenCalled();
    expect(animateBats).not.toHaveBeenCalled();
  });

  it('ends on controller completion without restarting after a rerender', async () => {
    const view = render(<HalloweenBats />);
    await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
    act(() => vi.mocked(animateBats).mock.calls[0][2]());
    view.rerender(<HalloweenBats />);
    expect(stop).toHaveBeenCalledOnce();
    expect(animateBats).toHaveBeenCalledOnce();
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
    const view = render(<HalloweenBats />);
    await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
    fireEvent(window, new Event(event));
    expect(stop).toHaveBeenCalledOnce();
    view.rerender(<HalloweenBats />);
    expect(animateBats).toHaveBeenCalledOnce();
  });

  it('ignores internal scroll restoration in its own copy host', async () => {
    render(<HalloweenBats />);
    await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
    const { copies } = vi.mocked(animateBats).mock.calls[0][1];
    fireEvent.scroll(copies);
    expect(stop).not.toHaveBeenCalled();
    expect(animateBats).toHaveBeenCalledOnce();
  });

  it('cancels deferred imports when the page is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    render(<HalloweenBats />);
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => undefined);
    expect(getBatTargets).not.toHaveBeenCalled();
    expect(animateBats).not.toHaveBeenCalled();
  });

  it('cancels preparation on interaction before imports resolve', async () => {
    render(<HalloweenBats />);
    fireEvent.pointerDown(window);
    await act(async () => undefined);
    expect(getBatTargets).not.toHaveBeenCalled();
    expect(animateBats).not.toHaveBeenCalled();
  });

  it('does not measure or begin after unmount during preparation', async () => {
    const view = render(<HalloweenBats />);
    view.unmount();
    await act(async () => undefined);
    expect(getBatTargets).not.toHaveBeenCalled();
    expect(animateBats).not.toHaveBeenCalled();
  });

  it('disposes StrictMode rehearsal before creating the real scene', async () => {
    const view = render(
      <StrictMode>
        <HalloweenBats />
      </StrictMode>,
    );
    await waitFor(() => expect(animateBats).toHaveBeenCalledOnce());
    expect(getBatTargets).toHaveBeenCalledOnce();
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
