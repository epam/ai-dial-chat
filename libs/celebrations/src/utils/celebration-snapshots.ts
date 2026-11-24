import { COPY_INTERACTION_EVENTS, makeTravelLayer } from './copy-layers';

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
  /** Share of `durationMs` over which each original fades back in from `restoreAt`. Defaults to `0.04`. */
  restoreShare?: number;
  /** Keyframes of an outer layer that carries each copy, composed with `frames` like a parent transform. */
  travelFrames?: (index: number) => Keyframe[];
}

const DEFAULT_RESTORE_SHARE = 0.04;

/** Share of `durationMs` over which each original fades out before `hideAt`; `hideAt` must not lie below it. */
export const SNAPSHOT_HIDE_FADE_SHARE = 0.01;

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
  const propertyNames = new Map<string, string>();
  const serializedName = (name: string) => {
    let serialized = propertyNames.get(name);
    if (serialized === undefined) {
      /* CSSOM names may contain unescaped characters in custom identifiers. */
      serialized = name.replace(
        /[^\w-]/gu,
        (character) => `\\${character.codePointAt(0)?.toString(16)} `,
      );
      propertyNames.set(name, serialized);
    }
    return serialized;
  };
  originals.forEach((original, index) => {
    const copy = duplicates[index];
    const style = getComputedStyle(original);
    /* Preserve invalid inline custom properties that computed style omits.
       Resolved properties keep the former setProperty priority semantics. */
    const remainingCustom = new Set(
      Array.from(copy.style).filter((name) => name.startsWith('--')),
    );
    let declarations = '';
    const propertyCount = style.length;
    for (let property = 0; property < propertyCount; property++) {
      const name = style[property];
      remainingCustom.delete(name);
      declarations += `${serializedName(name)}:${style.getPropertyValue(name)};`;
    }
    for (const name of remainingCustom) {
      const priority = copy.style.getPropertyPriority(name);
      declarations += `${serializedName(name)}:${copy.style.getPropertyValue(name)}${priority ? ' !important' : ''};`;
    }
    /* One parse/write per node avoids repeatedly expanding a large inline
       declaration block for every inherited theme variable. */
    copy.style.cssText = declarations;
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

/** Decorative copies prepared ahead of time, started on another actor's clock. */
export interface CelebrationSnapshotSession {
  /** Appends the copies to `host`, invisible, and restores their scroll positions. */
  attach: (host: HTMLElement) => void;
  /** Starts the copy and original animations, at `startTime` when given. */
  start: (startTime?: number) => void;
  /** Removes the copies and cancels every animation once; later calls do nothing. */
  stop: () => void;
}

/**
 * Clones `targets` without touching them; throws when a target exceeds the
 * node budget. No original is animated before `start`.
 */
export const prepareCelebrationSnapshots = (
  targets: readonly CelebrationSnapshotTarget[],
  options: SnapshotAnimationOptions,
): CelebrationSnapshotSession => {
  const copies = targets.map(({ element, rect }) =>
    makeSnapshot(element, rect),
  );
  const animations: Animation[] = [];
  const travelLayers: HTMLElement[] = [];
  let attachedHost: HTMLElement | null = null;
  let isStarted = false;
  let isStopped = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const events = COPY_INTERACTION_EVENTS;
  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    clearTimeout(deadline);
    observer.disconnect();
    animations.splice(0).forEach((animation) => animation.cancel());
    /* Removed copies are released too, so a retained session holds no DOM. */
    copies.splice(0).forEach((copy) => copy.remove());
    travelLayers.splice(0).forEach((layer) => layer.remove());
    attachedHost = null;
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
      attachedHost?.contains(event.target)
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
  const attach = (host: HTMLElement) => {
    if (isStopped || attachedHost) return;
    attachedHost = host;
    copies.forEach((copy, index) => {
      /* Invisible until `start`: the clone's own nodes copy `visibility: visible`. */
      copy.style.opacity = '0';
      if (options.travelFrames) {
        const layer = makeTravelLayer();
        layer.appendChild(copy);
        host.appendChild(layer);
        travelLayers.push(layer);
      } else {
        host.appendChild(copy);
      }
      const originals = [
        targets[index].element,
        ...targets[index].element.querySelectorAll('*'),
      ];
      const clone = copy.firstElementChild;
      if (!clone) throw new Error('Snapshot is empty');
      const clones = [clone, ...clone.querySelectorAll('*')];
      originals.forEach((original, i) => {
        clones[i].scrollTop = original.scrollTop;
        clones[i].scrollLeft = original.scrollLeft;
      });
      /* Runs after attachment, as before the split: a decorator may move the copy. */
      options.decorateCopy?.(copy, index);
    });
  };
  const start = (startTime?: number) => {
    if (isStopped || isStarted) return;
    if (!attachedHost) throw new Error('Snapshots are not attached');
    isStarted = true;
    copies.forEach((copy, index) => {
      const { element, rect } = targets[index];
      copy.style.opacity = '';
      animations.push(
        copy.animate(
          options.frames(rect, index).map((frame) => ({
            ...frame,
            easing: frame.easing ?? 'ease-in-out',
          })),
          { duration: options.durationMs, fill: 'both' },
        ),
      );
      const travel = travelLayers[index];
      if (travel && options.travelFrames)
        animations.push(
          travel.animate(options.travelFrames(index), {
            duration: options.durationMs,
            fill: 'both',
          }),
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
              { offset: hideAt - SNAPSHOT_HIDE_FADE_SHARE, opacity },
              { offset: hideAt, opacity: 0 },
              { offset: options.restoreAt, opacity: 0 },
              {
                offset: Math.min(
                  1,
                  options.restoreAt +
                    (options.restoreShare ?? DEFAULT_RESTORE_SHARE),
                ),
                opacity,
              },
              { offset: 1, opacity },
            ],
            { duration: options.durationMs, fill: 'both' },
          ),
        );
      }
    });
    if (startTime !== undefined) {
      animations.forEach((animation) => {
        animation.startTime = startTime;
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
  };
  return { attach, start, stop };
};

/** All borrowing lives in the decorative layer; canceling WAAPI restores the real UI. */
export const animateCelebrationSnapshots = (
  targets: readonly CelebrationSnapshotTarget[],
  host: HTMLElement,
  options: SnapshotAnimationOptions,
): (() => void) => {
  if (!targets.length || typeof host.animate !== 'function')
    return () => undefined;
  let session: CelebrationSnapshotSession | undefined;
  try {
    session = prepareCelebrationSnapshots(targets, options);
    session.attach(host);
    session.start(options.startTime);
  } catch {
    /* Unsupported animation or an oversized snapshot must leave chat usable. */
    if (session) session.stop();
    else options.onStop?.();
  }
  return session?.stop ?? (() => undefined);
};
