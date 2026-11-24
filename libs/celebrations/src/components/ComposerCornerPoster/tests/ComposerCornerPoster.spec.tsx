/* Decorative image/observer geometry has no accessible interaction surface. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { act, fireEvent, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ComposerCornerPoster,
  type ComposerCornerPosterProps,
} from '../ComposerCornerPoster';

const rectangles = new Map<Element, DOMRect>();
const mutations: TestMutationObserver[] = [];
const resizes: TestResizeObserver[] = [];
class TestMutationObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
  constructor(readonly callback: MutationCallback) {
    mutations.push(this);
  }
  emit(record: Partial<MutationRecord>) {
    this.callback(
      [record as MutationRecord],
      this as unknown as MutationObserver,
    );
  }
}
class TestResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: ResizeObserverCallback) {
    resizes.push(this);
  }
  emit() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const props: ComposerCornerPosterProps = {
  src: '/poster.svg',
  anchors: { composer: 'poster-composer' },
  direction: 'ltr',
  isMirrored: false,
  onDismiss: vi.fn(),
};
const load = (image: HTMLImageElement, width = 100, height = 125) => {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
  fireEvent.load(image);
};

describe('ComposerCornerPoster', () => {
  let composer: HTMLDivElement;
  let additionalTargets: HTMLElement[];
  beforeEach(() => {
    vi.mocked(props.onDismiss).mockClear();
    mutations.length = 0;
    resizes.length = 0;
    rectangles.clear();
    additionalTargets = [];
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      360,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      720,
    );
    vi.stubGlobal('MutationObserver', TestMutationObserver);
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return rectangles.get(this) ?? new DOMRect(0, 0, 0, 0);
      },
    );
    composer = document.createElement('div');
    composer.className = 'poster-composer';
    document.body.append(composer);
    rectangles.set(composer, new DOMRect(16, 610, 328, 90));
  });
  afterEach(() => {
    composer.remove();
    additionalTargets.forEach((target) => target.remove());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the image hidden until it can be placed above a docked draft', () => {
    const input = document.createElement('textarea');
    input.value = 'Keep this draft';
    composer.append(input);
    input.focus();
    input.setSelectionRange(2, 7);
    const before = composer.outerHTML;
    const { container } = render(<ComposerCornerPoster {...props} />);
    const image = container.querySelector('img') as HTMLImageElement;
    expect(image.style.visibility).toBe('hidden');
    load(image);
    expect(image.style.visibility).toBe('visible');
    expect(image.style.width).toBe('160px');
    expect(image.style.height).toBe('200px');
    expect(
      parseFloat(image.style.top) + parseFloat(image.style.height),
    ).toBeLessThanOrEqual(610);
    expect(composer.outerHTML).toBe(before);
    expect(input.value).toBe('Keep this draft');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 7]);
    expect(image.alt).toBe('');
    expect(container.firstElementChild?.hasAttribute('inert')).toBe(true);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('protects visible composers that cannot satisfy animated size limits', () => {
    rectangles.set(composer, new DOMRect(150, 20, 198, 320));
    const { container } = render(<ComposerCornerPoster {...props} />);
    const image = container.querySelector('img') as HTMLImageElement;
    load(image, 1, 1);
    const left = parseFloat(image.style.left);
    const top = parseFloat(image.style.top);
    const width = parseFloat(image.style.width);
    const height = parseFloat(image.style.height);
    expect(image.style.visibility).toBe('visible');
    expect(left + width <= 150 || top >= 340 || top + height <= 20).toBe(true);
  });

  it('shows no artwork when the only remaining slots are too small', () => {
    rectangles.set(composer, new DOMRect(0, 0, 360, 720));
    const { container } = render(<ComposerCornerPoster {...props} />);
    load(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    [...mutations, ...resizes].forEach((observer) =>
      expect(observer.disconnect).toHaveBeenCalledOnce(),
    );
  });

  it('optionally protects visible history without changing the default corner placement', () => {
    const history = document.createElement('nav');
    history.className = 'poster-history';
    document.body.append(history);
    additionalTargets.push(history);
    rectangles.set(history, new DOMRect(120, 12, 228, 300));
    const { container } = render(
      <ComposerCornerPoster
        {...props}
        protectHistory
        anchors={{ ...props.anchors, historyContainer: 'poster-history' }}
      />,
    );
    const image = container.querySelector('img') as HTMLImageElement;
    load(image);
    expect(image.style.visibility).toBe('visible');
    const left = parseFloat(image.style.left);
    const top = parseFloat(image.style.top);
    const width = parseFloat(image.style.width);
    expect(left + width <= 120 || top >= 312).toBe(true);
    act(() => mutations[0].emit({ type: 'attributes', target: history }));
    expect(container.querySelector('img')).toBeNull();
  });

  it('reserves newly mounted history while a protected poster is pending', () => {
    const { container } = render(
      <ComposerCornerPoster
        {...props}
        protectHistory
        anchors={{ ...props.anchors, historyContainer: 'poster-history' }}
      />,
    );
    const history = document.createElement('nav');
    history.className = 'poster-history';
    additionalTargets.push(history);
    document.body.append(history);
    rectangles.set(history, new DOMRect(120, 12, 228, 300));
    act(() =>
      mutations[0].emit({
        type: 'childList',
        target: document.body,
        addedNodes: [history] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
      }),
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('dismisses a failed image and ignores a later load event', () => {
    const { container } = render(<ComposerCornerPoster {...props} />);
    const image = container.querySelector('img') as HTMLImageElement;
    fireEvent.error(image);
    load(image);
    expect(container.querySelector('img')).toBeNull();
  });

  it.each(['pointerdown', 'keydown', 'input', 'scroll'])(
    'cancels a pending image on %s without late resurrection',
    (name) => {
      const { container } = render(<ComposerCornerPoster {...props} />);
      const image = container.querySelector('img') as HTMLImageElement;
      fireEvent(window, new Event(name));
      load(image);
      expect(container.querySelector('img')).toBeNull();
    },
  );

  it('observes protected content while the image is still pending', () => {
    const { container } = render(<ComposerCornerPoster {...props} />);
    const image = container.querySelector('img') as HTMLImageElement;
    act(() => mutations[0].emit({ type: 'attributes', target: composer }));
    load(image);
    expect(container.querySelector('img')).toBeNull();
  });

  it('cancels when host content appears after an activation with no anchors', () => {
    composer.remove();
    const { container } = render(<ComposerCornerPoster {...props} />);
    const image = container.querySelector('img') as HTMLImageElement;
    load(image);
    document.body.append(composer);
    act(() =>
      mutations[0].emit({
        type: 'childList',
        target: document.body,
        addedNodes: [composer] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
      }),
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('removes a visible still when an ancestor resize moves the composer', () => {
    const { container } = render(<ComposerCornerPoster {...props} />);
    load(container.querySelector('img') as HTMLImageElement);
    rectangles.set(composer, new DOMRect(16, 500, 328, 90));
    act(() => resizes.forEach((observer) => observer.emit()));
    expect(container.querySelector('img')).toBeNull();
  });

  it.each(['hidden', 'absent'])(
    'dismisses when an initially %s supplied sibling control appears without moving the composer',
    (initialState) => {
      const control = document.createElement('div');
      control.className = 'poster-model-control';
      additionalTargets.push(control);
      rectangles.set(control, new DOMRect(200, 20, 140, 120));
      if (initialState === 'hidden') {
        control.hidden = true;
        document.body.append(control);
      }
      const { container } = render(
        <ComposerCornerPoster
          {...props}
          anchors={{
            ...props.anchors,
            composerModelSelector: 'poster-model-control',
          }}
        />,
      );
      const image = container.querySelector('img') as HTMLImageElement;
      load(image);
      expect(image.style.visibility).toBe('visible');

      act(() => {
        if (initialState === 'hidden') {
          control.hidden = false;
          mutations[0].emit({ type: 'attributes', target: control });
        } else {
          document.body.append(control);
          mutations[0].emit({
            type: 'childList',
            target: document.body,
            addedNodes: [control] as unknown as NodeList,
            removedNodes: [] as unknown as NodeList,
          });
        }
      });
      load(image);
      expect(container.querySelector('img')).toBeNull();
      expect(props.onDismiss).toHaveBeenCalledOnce();
    },
  );

  it('dismisses when a missing composer mounts beside an unchanged visible control', () => {
    composer.remove();
    const control = document.createElement('div');
    control.className = 'poster-model-control';
    additionalTargets.push(control);
    rectangles.set(control, new DOMRect(16, 610, 60, 30));
    document.body.append(control);
    const { container } = render(
      <ComposerCornerPoster
        {...props}
        anchors={{
          ...props.anchors,
          composerModelSelector: 'poster-model-control',
        }}
      />,
    );
    const image = container.querySelector('img') as HTMLImageElement;
    load(image);
    expect(image.style.visibility).toBe('visible');
    rectangles.set(composer, new DOMRect(160, 20, 184, 200));
    document.body.append(composer);
    act(() =>
      mutations[0].emit({
        type: 'childList',
        target: document.body,
        addedNodes: [composer] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
      }),
    );
    load(image);
    expect(container.querySelector('img')).toBeNull();
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it('ignores its own image changes without rereading host geometry', () => {
    const { container } = render(<ComposerCornerPoster {...props} />);
    const image = container.querySelector('img') as HTMLImageElement;
    load(image);
    const before = vi.mocked(Element.prototype.getBoundingClientRect).mock.calls
      .length;
    act(() =>
      mutations.forEach((observer) =>
        observer.emit({ type: 'attributes', target: image }),
      ),
    );
    expect(
      vi.mocked(Element.prototype.getBoundingClientRect).mock.calls,
    ).toHaveLength(before);
    expect(image.style.visibility).toBe('visible');
  });

  it('releases observers and interrupt listeners once after dismissal and unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { container, unmount } = render(<ComposerCornerPoster {...props} />);
    load(container.querySelector('img') as HTMLImageElement);
    fireEvent.pointerDown(window);
    unmount();
    expect(props.onDismiss).toHaveBeenCalledOnce();
    [...mutations, ...resizes].forEach((observer) =>
      expect(observer.disconnect).toHaveBeenCalledOnce(),
    );
    const installed = add.mock.calls.find(([name]) => name === 'pointerdown');
    expect(
      remove.mock.calls.filter(
        ([name, listener]) =>
          name === 'pointerdown' && listener === installed?.[1],
      ),
    ).toHaveLength(1);
  });

  it('handles a cached image and StrictMode setup without stranding observers', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(
      true,
    );
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
      100,
    );
    vi.spyOn(
      HTMLImageElement.prototype,
      'naturalHeight',
      'get',
    ).mockReturnValue(125);
    const { container, unmount } = render(
      <StrictMode>
        <ComposerCornerPoster {...props} />
      </StrictMode>,
    );
    expect(
      (container.querySelector('img') as HTMLImageElement).style.visibility,
    ).toBe('visible');
    unmount();
    [...mutations, ...resizes].forEach((observer) =>
      expect(observer.disconnect).toHaveBeenCalledOnce(),
    );
  });

  it.each(['MutationObserver', 'ResizeObserver'])(
    'omits the image if %s cannot protect its placement',
    (name) => {
      vi.stubGlobal(name, undefined);
      const { container } = render(<ComposerCornerPoster {...props} />);
      expect(container.querySelector('img')).toBeNull();
    },
  );

  it('uses the offset visual viewport and dismisses on its resize', () => {
    const viewport = Object.assign(new EventTarget(), {
      offsetLeft: 20,
      offsetTop: 100,
      width: 320,
      height: 350,
    });
    vi.stubGlobal('visualViewport', viewport);
    const { container } = render(<ComposerCornerPoster {...props} />);
    const image = container.querySelector('img') as HTMLImageElement;
    load(image);
    expect(parseFloat(image.style.left)).toBeGreaterThanOrEqual(32);
    expect(parseFloat(image.style.top)).toBeGreaterThanOrEqual(120);
    expect(
      parseFloat(image.style.top) + parseFloat(image.style.height),
    ).toBeLessThanOrEqual(430);
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses supplied RTL direction and terminates on a changed activation input', () => {
    document.documentElement.dir = 'ltr';
    const rtlProps = { ...props, direction: 'rtl' as const, isMirrored: true };
    const { container, rerender } = render(
      <ComposerCornerPoster {...rtlProps} />,
    );
    const image = container.querySelector('img') as HTMLImageElement;
    load(image);
    expect(image.style.left).toBe('12px');
    expect(image.style.transform).toBe('scaleX(-1)');
    rerender(<ComposerCornerPoster {...rtlProps} src="/next.svg" />);
    rerender(<ComposerCornerPoster {...rtlProps} />);
    load(image);
    expect(container.querySelector('img')).toBeNull();
    document.documentElement.removeAttribute('dir');
  });
});
