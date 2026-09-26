/** A live application element paired with its pre-animation viewport bounds. */
export interface CelebrationSnapshotTarget {
  element: HTMLElement;
  rect: DOMRect;
}
interface SnapshotAnimationOptions {
  durationMs: number;
  hideAt: number | ((index: number) => number);
  restoreAt: number;
  frames: (rect: DOMRect, index: number) => Keyframe[];
  decorateCopy?: (copy: HTMLElement, index: number) => void;
  /** Cropped fragments can mask just their cutout instead of hiding the whole source. */
  hideOriginal?: boolean;
  onStop?: () => void;
  /** Align snapshots with another actor after all copies have been prepared. */
  startTime?: number;
}

let snapshotId = 0;

/** Freeze computed presentation, including scrolled content, without reparenting React nodes. */
const makeSnapshot = (element: HTMLElement, rect: DOMRect): HTMLElement => {
  const originals = [
    element,
    ...element.querySelectorAll<HTMLElement | SVGElement>('*'),
  ];
  /* Skip unusually large custom panels rather than blocking a chat submission. */
  if (originals.length > 1500)
    throw new Error('Decorative snapshot exceeds its node budget');
  const clone = element.cloneNode(true) as HTMLElement;
  const duplicates = [
    clone,
    ...clone.querySelectorAll<HTMLElement | SVGElement>('*'),
  ];
  const prefix = `celebration-copy-${++snapshotId}-`;
  const ids = new Map<string, string>();
  originals.forEach((original, index) => {
    const copy = duplicates[index];
    const style = getComputedStyle(original);
    for (const name of Array.from(style))
      copy.style.setProperty(name, style.getPropertyValue(name));
    copy.style.animation = 'none';
    copy.style.transition = 'none';
    if (copy.id) {
      ids.set(copy.id, `${prefix}${index}`);
      copy.id = `${prefix}${index}`;
    }
    if (
      original instanceof HTMLTextAreaElement &&
      copy instanceof HTMLTextAreaElement
    )
      copy.value = original.value;
    if (
      original instanceof HTMLInputElement &&
      copy instanceof HTMLInputElement &&
      original.type !== 'file'
    ) {
      copy.value = original.value;
      copy.checked = original.checked;
    }
    copy.removeAttribute('autofocus');
    copy.removeAttribute('name');
    if (copy.tagName.toLowerCase() === 'a') copy.removeAttribute('href');
  });
  duplicates.forEach((copy) => {
    for (const attribute of ['fill', 'stroke', 'clip-path', 'mask', 'filter']) {
      const reference = copy
        .getAttribute(attribute)
        ?.match(/^url\(#(.+)\)$/)?.[1];
      if (reference && ids.has(reference)) {
        const value = `url(#${ids.get(reference)})`;
        copy.setAttribute(attribute, value);
        copy.style.setProperty(attribute, value);
      }
    }
  });
  Object.assign(clone.style, {
    position: 'relative',
    inset: 'auto',
    margin: '0',
    transform: 'none',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    minWidth: '0',
    minHeight: '0',
    maxWidth: 'none',
    maxHeight: 'none',
    animation: 'none',
    transition: 'none',
  });
  const wrapper = document.createElement('div');
  wrapper.inert = true;
  wrapper.setAttribute('aria-hidden', 'true');
  Object.assign(wrapper.style, {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
    margin: '0',
    transformOrigin: 'center',
  });
  wrapper.appendChild(clone);
  /* Apply scroll positions after attachment, when scrollable boxes have layout. */
  wrapper.dataset.celebrationSnapshot = 'true';
  return wrapper;
};

/** All borrowing lives in the decorative layer; canceling WAAPI restores the real UI. */
export const animateCelebrationSnapshots = (
  targets: readonly CelebrationSnapshotTarget[],
  host: HTMLElement,
  options: SnapshotAnimationOptions,
): (() => void) => {
  if (!targets.length || typeof host.animate !== 'function')
    return () => undefined;
  const copies: HTMLElement[] = [];
  const animations: Animation[] = [];
  let stopped = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const events = [
    'scroll',
    'pointerdown',
    'focusin',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'visibilitychange',
  ];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    observer.disconnect();
    animations.forEach((animation) => animation.cancel());
    copies.forEach((copy) => copy.remove());
    events.forEach((name) =>
      document.removeEventListener(name, onInteraction, true),
    );
    window.removeEventListener('resize', stop);
    options.onStop?.();
  };
  const onInteraction = (event: Event) => {
    /* Restoring a clone's scroll position emits scroll too; only live UI interrupts. */
    if (
      event.type === 'scroll' &&
      event.target instanceof Node &&
      host.contains(event.target)
    )
      return;
    stop();
  };
  const observer = new MutationObserver((records) => {
    if (
      targets.some(
        ({ element }) =>
          !element.isConnected ||
          element.closest('[inert], [aria-hidden="true"]') ||
          records.some(
            (record) =>
              element.contains(record.target) ||
              (record.type === 'attributes' &&
                record.target instanceof Element &&
                record.target.contains(element)),
          ),
      )
    )
      stop();
  });
  try {
    targets.forEach(({ element, rect }, index) => {
      const copy = makeSnapshot(element, rect);
      copies.push(copy);
      host.appendChild(copy);
      const originals = [element, ...element.querySelectorAll('*')];
      const clone = copy.firstElementChild;
      if (!clone) throw new Error('Snapshot is empty');
      const clones = [clone, ...clone.querySelectorAll('*')];
      originals.forEach((original, i) => {
        clones[i].scrollTop = original.scrollTop;
        clones[i].scrollLeft = original.scrollLeft;
      });
      options.decorateCopy?.(copy, index);
      animations.push(
        copy.animate(
          options.frames(rect, index).map((frame) => ({
            ...frame,
            easing: frame.easing ?? 'ease-in-out',
          })),
          { duration: options.durationMs, fill: 'both' },
        ),
      );
      if (options.hideOriginal !== false) {
        const opacity = getComputedStyle(element).opacity;
        const hideAt =
          typeof options.hideAt === 'function'
            ? options.hideAt(index)
            : options.hideAt;
        animations.push(
          element.animate(
            [
              { offset: 0, opacity },
              { offset: hideAt - 0.01, opacity },
              { offset: hideAt, opacity: 0 },
              { offset: options.restoreAt, opacity: 0 },
              { offset: Math.min(1, options.restoreAt + 0.04), opacity },
              { offset: 1, opacity },
            ],
            { duration: options.durationMs, fill: 'both' },
          ),
        );
      }
    });
    if (options.startTime !== undefined) {
      animations.forEach((animation) => {
        animation.startTime = options.startTime ?? null;
      });
    }
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'href',
        'inert',
        'aria-hidden',
        'aria-expanded',
        'class',
        'style',
        'dir',
      ],
    });
    events.forEach((name) =>
      document.addEventListener(name, onInteraction, true),
    );
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, options.durationMs);
  } catch {
    /* Unsupported animation or an oversized snapshot must leave chat usable. */
    stop();
  }
  return stop;
};
