/* Inert SVG artwork has no accessible controls; query its geometry explicitly. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGiftWrappingTarget } from '../../../utils/gift-wrapping-targets';
import NewYearGiftWrapping from '../NewYearGiftWrapping';

const state = vi.hoisted(() => ({ mobile: false, reduced: false }));
vi.mock('../../../../context/CelebrationEnvironmentContext', async () => {
  const { testEnvironment } =
    await import('../../../../test-utils/environment');
  const anchors = { composer: 'gift-composer' };
  return {
    useCelebrationEnvironment: () =>
      testEnvironment({ anchors, isMobile: state.mobile }),
  };
});
vi.mock('../../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => state.reduced,
}));
vi.mock('../../../utils/gift-wrapping-targets', () => ({
  getGiftWrappingTarget: vi.fn(),
}));

const descriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const animations: {
  cancel: ReturnType<typeof vi.fn>;
  frames: Keyframe[];
  element: Element;
}[] = [];
const disconnect = vi.fn();
let onResize: () => void;
let fixture: HTMLDivElement;
let sourceRect: DOMRect;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.mobile = false;
  state.reduced = false;
  animations.length = 0;
  sourceRect = new DOMRect(400, 350, 560, 100);
  fixture = document.createElement('div');
  fixture.innerHTML = '<textarea aria-label="Draft">Private draft</textarea>';
  document.body.append(fixture);
  vi.spyOn(fixture, 'getBoundingClientRect').mockImplementation(
    () => sourceRect,
  );
  vi.mocked(getGiftWrappingTarget).mockReturnValue({
    width: 1280,
    height: 900,
    rtl: false,
    box: { left: 400, top: 350, width: 560, height: 100 },
    source: { element: fixture, rect: sourceRect },
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        onResize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(function (this: Element, frames: Keyframe[]) {
      const animation = { element: this, frames, cancel: vi.fn() };
      animations.push(animation);
      return animation;
    }),
  });
});
afterEach(() => {
  fixture.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (descriptor)
    Object.defineProperty(Element.prototype, 'animate', descriptor);
  else Reflect.deleteProperty(Element.prototype, 'animate');
});
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
const expectReleased = () => {
  expect(animations.length).toBeGreaterThan(0);
  expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
  expect(disconnect).toHaveBeenCalledOnce();
};

describe('Gift wrapping scene lifecycle', () => {
  it.each([false, true])(
    'keeps the draft and bounded artwork intact, mobile=%s',
    async (mobile) => {
      state.mobile = mobile;
      const input = screen.getByRole('textbox', {
        name: 'Draft',
      }) as HTMLTextAreaElement;
      input.focus();
      input.setSelectionRange(2, 7, 'backward');
      const before = fixture.outerHTML;
      const view = render(
        <StrictMode>
          <NewYearGiftWrapping />
        </StrictMode>,
      );
      await flush();
      expect(getGiftWrappingTarget).toHaveBeenCalledOnce();
      expect(animations.length).toBeLessThanOrEqual(mobile ? 24 : 32);
      const elves = view.container.querySelectorAll('[data-elf-art]');
      expect(elves).toHaveLength(2);
      elves.forEach((elf) => {
        expect(elf.querySelectorAll('*').length).toBeLessThanOrEqual(80);
        expect(elf.querySelectorAll('path').length).toBeLessThanOrEqual(40);
        expect(
          elf.querySelectorAll('linearGradient').length,
        ).toBeLessThanOrEqual(3);
        const commands = [...elf.querySelectorAll('path')].reduce(
          (sum, path) =>
            sum + (path.getAttribute('d')?.match(/[a-df-z]/gi)?.length ?? 0),
          0,
        );
        expect(commands).toBeLessThanOrEqual(800);
      });
      expect(
        view.container.querySelector('filter,mask,image,foreignObject'),
      ).toBeNull();
      const ids = [...view.container.querySelectorAll('[id]')].map(
        (el) => el.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(screen.queryByRole('img')).toBeNull();
      expect(document.activeElement).toBe(input);
      expect([
        input.value,
        input.selectionStart,
        input.selectionEnd,
        input.selectionDirection,
      ]).toEqual(['Private draft', 2, 7, 'backward']);
      expect(fixture.outerHTML).toBe(before);
      act(() => vi.advanceTimersByTime(18000));
      expectReleased();
      expect(view.container.querySelector('svg')).toBeNull();
      expect(fixture.outerHTML).toBe(before);
      view.unmount();
    },
  );

  it.each([
    'pointerdown',
    'click',
    'keydown',
    'focusin',
    'focusout',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'resize',
    'visibilitychange',
  ])('releases animation immediately on %s', async (name) => {
    const view = render(<NewYearGiftWrapping />);
    await flush();
    if (name === 'visibilitychange')
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => window.dispatchEvent(new Event(name)));
    expectReleased();
    expect(view.container.querySelector('svg')).toBeNull();
    view.unmount();
  });

  it.each(['reduced', 'unsupported', 'noResizeObserver', 'noMutationObserver'])(
    'does not measure host controls for %s',
    async (mode) => {
      state.reduced = mode === 'reduced';
      if (mode === 'unsupported')
        Reflect.deleteProperty(Element.prototype, 'animate');
      if (mode === 'noResizeObserver')
        vi.stubGlobal('ResizeObserver', undefined);
      if (mode === 'noMutationObserver')
        vi.stubGlobal('MutationObserver', undefined);
      const view = render(<NewYearGiftWrapping />);
      await flush();
      expect(getGiftWrappingTarget).not.toHaveBeenCalled();
      expect(animations).toHaveLength(0);
      expect(view.container.querySelector('[data-gift-static]')).not.toBeNull();
      expect(view.container.querySelectorAll('[data-elf-art]')).toHaveLength(2);
      view.unmount();
    },
  );

  it.each(['typing', 'unmount'])(
    'cancels pending preparation on %s',
    async (mode) => {
      const view = render(<NewYearGiftWrapping />);
      if (mode === 'typing')
        fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      else view.unmount();
      await flush();
      expect(getGiftWrappingTarget).not.toHaveBeenCalled();
      expect(animations).toHaveLength(0);
      view.unmount();
    },
  );

  it.each(['resize', 'mutation', 'remove', 'reduced', 'mobile'])(
    'restores the page when the source or environment changes: %s',
    async (mode) => {
      const view = render(<NewYearGiftWrapping />);
      await flush();
      if (mode === 'resize')
        act(() => {
          sourceRect = new DOMRect(400, 380, 560, 100);
          onResize();
        });
      if (mode === 'mutation') {
        fixture.style.display = 'none';
        await flush();
      }
      if (mode === 'remove') {
        fixture.remove();
        await flush();
      }
      if (mode === 'reduced') {
        state.reduced = true;
        view.rerender(<NewYearGiftWrapping />);
      }
      if (mode === 'mobile') {
        state.mobile = true;
        view.rerender(<NewYearGiftWrapping />);
      }
      expectReleased();
      expect(view.container.querySelector('svg')).toBeNull();
      view.unmount();
    },
  );

  it('cleans partial animation startup failure', async () => {
    const animate = vi.mocked(Element.prototype.animate);
    animate.mockImplementationOnce(function (this: Element, frames) {
      const a = {
        cancel: vi.fn(),
        frames: frames as Keyframe[],
        element: this,
      };
      animations.push(a);
      return a as unknown as Animation;
    });
    animate.mockImplementationOnce(() => {
      throw new Error('Animation unavailable');
    });
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(animations).toHaveLength(1);
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(view.container.querySelector('svg')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('leaves no animations or timers after repeated mounts and interrupts', async () => {
    for (let i = 0; i < 4; i++) {
      const view = render(<NewYearGiftWrapping />);
      await flush();
      fireEvent.input(screen.getByRole('textbox', { name: 'Draft' }));
      view.unmount();
    }
    expect(disconnect).toHaveBeenCalledTimes(4);
    expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(
      true,
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('plays the parcel fallback with both elves and cancels on visual viewport changes', async () => {
    const viewport = new EventTarget();
    vi.stubGlobal('visualViewport', viewport);
    vi.mocked(getGiftWrappingTarget).mockReturnValue({
      width: 360,
      height: 800,
      rtl: false,
      box: { left: 55, top: 450, width: 250, height: 66 },
      source: null,
    });
    const view = render(<NewYearGiftWrapping />);
    await flush();
    expect(
      view.container.querySelector('[data-gift-target="parcel"]'),
    ).not.toBeNull();
    expect(view.container.querySelectorAll('[data-elf-art]')).toHaveLength(2);
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(view.container.querySelector('svg')).toBeNull();
    expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(
      true,
    );
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
  });

  it('ignores unrelated decoration changes but cancels an event-driven anchor move', async () => {
    const view = render(<NewYearGiftWrapping />);
    await flush();
    const scene = view.container.querySelector('[data-new-year-scene]');
    if (!scene) throw new Error('Missing scene');
    scene.setAttribute('data-probe', 'decoration');
    await flush();
    const reads = vi.mocked(fixture.getBoundingClientRect).mock.calls.length;
    act(() => vi.advanceTimersByTime(8000));
    expect(vi.mocked(fixture.getBoundingClientRect).mock.calls.length).toBe(
      reads,
    );
    expect(animations.every((a) => a.cancel.mock.calls.length === 0)).toBe(
      true,
    );
    sourceRect = new DOMRect(400, 380, 560, 100);
    const sibling = document.createElement('div');
    document.body.append(sibling);
    await flush();
    expectReleased();
    sibling.remove();
    view.unmount();
  });
});
