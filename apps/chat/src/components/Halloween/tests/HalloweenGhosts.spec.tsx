import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HALLOWEEN_GHOST_COUNT } from '../../../constants/halloween';
import { HalloweenGhostVariant } from '../../../types/halloween';
import { animateGhosts } from '../../../utils/halloween-ghost-animation';
import { buildGhostPlan } from '../../../utils/halloween-ghost-plan';
import { getGhostTargets } from '../../../utils/halloween-ghost-targets';
import HalloweenGhosts from '../HalloweenGhosts';

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
vi.mock('../../../utils/halloween-ghost-animation', () => ({
  animateGhosts: vi.fn(),
}));
vi.mock('../../../utils/halloween-ghost-plan', () => ({
  buildGhostPlan: vi.fn(),
}));
vi.mock('../../../utils/halloween-ghost-targets', () => ({
  getGhostTargets: vi.fn(),
}));

const stop = vi.fn();
const decorativeElements = (root: Element | null, selector: string) => {
  /* Decorative, inert artwork deliberately has no accessible roles to query. */
  // eslint-disable-next-line testing-library/no-node-access
  return root ? Array.from(root.querySelectorAll<HTMLElement>(selector)) : [];
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
  vi.mocked(animateGhosts).mockReturnValue(stop);
  vi.mocked(getGhostTargets).mockReturnValue({
    width: 1280,
    height: 800,
    homes: [],
  });
  vi.mocked(buildGhostPlan).mockImplementation((targets, mobile) => ({
    active: true,
    width: targets.width,
    height: targets.height,
    pumpkin: {
      element: document.createElement('span'),
      rect: new DOMRect(480, 440, 96, 96),
    },
    homes: [],
    leaderHome: 0,
    actors: Array.from({ length: mobile ? 3 : 5 }, (_, index) => ({
      variant: Object.values(HalloweenGhostVariant)[index % 4],
      size: 64,
      leader: index === 0,
      home: index,
      rest: { x: 100 + index * 120, y: 180 },
      frames: [],
      clothFrames: [],
      frightFrames: [],
    })),
  }));
});
afterEach(() => {
  if (animateDescriptor)
    Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
  vi.restoreAllMocks();
});

describe('ghost scene integration', () => {
  it.each([true, false])(
    'prepares bounded decorative actors without disturbing the draft or focus, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const view = render(<input aria-label="Message" defaultValue="Draft" />);
      const input = screen.getByRole('textbox', { name: 'Message' });
      input.focus();
      view.rerender(
        <>
          <input aria-label="Message" defaultValue="Draft" />
          <HalloweenGhosts />
        </>,
      );
      await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
      const [plan, elements] = vi.mocked(animateGhosts).mock.calls[0];
      expect(plan.actors).toHaveLength(mobile ? 3 : 5);
      expect(elements.actors).toHaveLength(plan.actors.length);
      expect(getGhostTargets).toHaveBeenCalledWith(
        'composer',
        'starters',
        mobile ? 3 : 5,
      );
      expect(elements.host.getAttribute('aria-hidden')).toBe('true');
      expect(elements.host.hasAttribute('inert')).toBe(true);
      expect(
        decorativeElements(elements.faceTemplate, '[data-ghost-pupil]'),
      ).toHaveLength(2);
      expect(
        decorativeElements(elements.actors[0], '[data-ghost-cloth]'),
      ).toHaveLength(1);
      expect(
        decorativeElements(elements.actors[0], '[data-ghost-fright-face]'),
      ).toHaveLength(1);
      expect(input.matches(':focus')).toBe(true);
      expect((input as HTMLInputElement).value).toBe('Draft');
      expect(screen.queryByRole('img')).toBeNull();
      view.unmount();
      expect(stop).toHaveBeenCalledOnce();
    },
  );

  it('keeps one random plan when an ancestor rerenders', async () => {
    const view = render(<HalloweenGhosts />);
    await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
    view.rerender(<HalloweenGhosts />);
    expect(animateGhosts).toHaveBeenCalledOnce();
    expect(buildGhostPlan).toHaveBeenCalledOnce();
    expect(getGhostTargets).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it('retains the diverse flight fallback when anchors are unavailable', async () => {
    vi.mocked(buildGhostPlan).mockReturnValue({
      active: false,
      width: 1280,
      height: 800,
      homes: [],
      actors: [],
      leaderHome: -1,
    });
    const view = render(<HalloweenGhosts />);
    await waitFor(() => expect(buildGhostPlan).toHaveBeenCalledOnce());
    expect(animateGhosts).not.toHaveBeenCalled();
    const ghosts = decorativeElements(view.container, '[data-ghost-fallback]');
    expect(ghosts).toHaveLength(HALLOWEEN_GHOST_COUNT);
    const paths = Array.from(ghosts, (ghost) => ghost.getAttribute('style'));
    view.rerender(<HalloweenGhosts />);
    expect(Array.from(ghosts, (ghost) => ghost.getAttribute('style'))).toEqual(
      paths,
    );
    expect(
      decorativeElements(view.container, '[data-stationary="false"]'),
    ).toHaveLength(1);
  });

  it.each(['reduced motion', 'unsupported WAAPI'])(
    'renders stationary artwork without measuring targets under %s',
    async (condition) => {
      if (condition === 'reduced motion') state.reduced = true;
      else Reflect.deleteProperty(Element.prototype, 'animate');
      const view = render(<HalloweenGhosts />);
      await act(async () => undefined);
      expect(getGhostTargets).not.toHaveBeenCalled();
      expect(animateGhosts).not.toHaveBeenCalled();
      expect(
        decorativeElements(view.container, '[data-stationary="true"]'),
      ).toHaveLength(1);
      expect(
        decorativeElements(view.container, '[data-ghost-fallback]'),
      ).toHaveLength(HALLOWEEN_GHOST_COUNT);
    },
  );

  it('restores and never restarts after crossing the breakpoint and returning', async () => {
    const view = render(<HalloweenGhosts />);
    await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
    state.mobile = true;
    view.rerender(<HalloweenGhosts />);
    expect(stop).toHaveBeenCalledOnce();
    state.mobile = false;
    view.rerender(<HalloweenGhosts />);
    await act(async () => undefined);
    expect(animateGhosts).toHaveBeenCalledOnce();
    expect(getGhostTargets).toHaveBeenCalledOnce();
    expect(
      decorativeElements(view.container, '[data-ended="true"]'),
    ).toHaveLength(1);
  });

  it('restores and stays stopped after a live motion preference change', async () => {
    render(<HalloweenGhosts />);
    await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
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
    expect(animateGhosts).toHaveBeenCalledOnce();
    expect(getGhostTargets).toHaveBeenCalledOnce();
  });

  it('does not begin motion if reduced motion is disabled during a static scene', async () => {
    state.reduced = true;
    render(<HalloweenGhosts />);
    act(() => {
      state.reduced = false;
      state.listeners.forEach((listener) => listener());
    });
    await act(async () => undefined);
    expect(getGhostTargets).not.toHaveBeenCalled();
    expect(animateGhosts).not.toHaveBeenCalled();
  });

  it('honors runner completion and ignores later rerenders', async () => {
    const view = render(<HalloweenGhosts />);
    await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
    act(() => vi.mocked(animateGhosts).mock.calls[0][2]());
    view.rerender(<HalloweenGhosts />);
    expect(stop).toHaveBeenCalledOnce();
    expect(animateGhosts).toHaveBeenCalledOnce();
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
  ])('restores borrowed visuals on %s and cannot restart', async (event) => {
    const view = render(<HalloweenGhosts />);
    await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
    fireEvent(window, new Event(event));
    expect(stop).toHaveBeenCalledOnce();
    view.rerender(<HalloweenGhosts />);
    expect(animateGhosts).toHaveBeenCalledOnce();
  });

  it('ignores snapshot scrolling inside its own decorative host', async () => {
    render(<HalloweenGhosts />);
    await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
    const { copies } = vi.mocked(animateGhosts).mock.calls[0][1];
    fireEvent.scroll(copies);
    expect(stop).not.toHaveBeenCalled();
    expect(animateGhosts).toHaveBeenCalledOnce();
  });

  it('cancels deferred preparation when the document becomes hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    render(<HalloweenGhosts />);
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => undefined);
    expect(getGhostTargets).not.toHaveBeenCalled();
    expect(animateGhosts).not.toHaveBeenCalled();
  });

  it('cancels preparation on interaction before imports resolve', async () => {
    render(<HalloweenGhosts />);
    fireEvent.pointerDown(window);
    await act(async () => undefined);
    expect(getGhostTargets).not.toHaveBeenCalled();
    expect(animateGhosts).not.toHaveBeenCalled();
  });

  it('does not measure or start after unmount during preparation', async () => {
    const view = render(<HalloweenGhosts />);
    view.unmount();
    await act(async () => undefined);
    expect(getGhostTargets).not.toHaveBeenCalled();
    expect(animateGhosts).not.toHaveBeenCalled();
  });

  it('disposes the rehearsal preparation in StrictMode', async () => {
    const view = render(
      <StrictMode>
        <HalloweenGhosts />
      </StrictMode>,
    );
    await waitFor(() => expect(animateGhosts).toHaveBeenCalledOnce());
    expect(getGhostTargets).toHaveBeenCalledOnce();
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
