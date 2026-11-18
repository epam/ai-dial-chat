import type { ComposerSource } from './composer-target';

/* Viewport-tolerance for a composer that is still where it was measured. */
const MOVE_TOLERANCE_PX = 0.5;
const MAX_OBSERVED_ANCESTORS = 24;

/** What `watchComposer` needs from a scene session. */
export interface ComposerWatchContext {
  /** The measured composer, or `null` when the scene plays without one. */
  source: ComposerSource | null;
  /** The renderer's element; mutations inside it are ignored. */
  host: HTMLElement;
  /** Registers a cleanup that runs once when the session ends. */
  addDisposer: (dispose: () => void) => void;
  /** Ends the session as cancelled. */
  cancel: () => void;
}

/** Cancels the scene when the measured composer moves, changes or disconnects; mutations inside `host` are ignored. */
export const watchComposer = ({
  source,
  host,
  addDisposer,
  cancel,
}: ComposerWatchContext): void => {
  if (!source) return;
  const moved = () => {
    const current = source.element.getBoundingClientRect();
    if (
      !source.element.isConnected ||
      (['left', 'top', 'width', 'height'] as const).some(
        (key) => Math.abs(current[key] - source.rect[key]) > MOVE_TOLERANCE_PX,
      )
    )
      cancel();
  };
  const mutation = new MutationObserver((records) => {
    const relevant = records.filter(
      (r) =>
        !host.contains(r.target) &&
        !(
          r.type === 'childList' &&
          [...r.addedNodes, ...r.removedNodes].every(
            (n) => n === host || host.contains(n),
          )
        ),
    );
    if (
      !source.element.isConnected ||
      relevant.some(
        (r) =>
          source.element.contains(r.target) ||
          (r.type === 'attributes' &&
            r.target instanceof Element &&
            r.target.contains(source.element)),
      )
    ) {
      cancel();
    } else if (relevant.length) moved();
  });
  /* Each observer is released as soon as it exists, so a later throw in this
     adapter cannot leave it connected. */
  addDisposer(() => mutation.disconnect());
  mutation.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'class',
      'style',
      'dir',
      'hidden',
      'inert',
      'aria-hidden',
      'open',
    ],
  });
  const resize = new ResizeObserver(moved);
  addDisposer(() => resize.disconnect());
  let ancestor: HTMLElement | null = source.element;
  for (
    let depth = 0;
    ancestor && depth < MAX_OBSERVED_ANCESTORS;
    depth++, ancestor = ancestor.parentElement
  )
    resize.observe(ancestor);
};
