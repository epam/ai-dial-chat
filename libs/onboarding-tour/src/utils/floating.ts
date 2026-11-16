import { flip, offset, shift, type Middleware } from '@floating-ui/react';
import {
  SPOTLIGHT_PADDING,
  TARGET_GAP,
  VIEWPORT_MARGIN,
} from '../constants/layout';
import type { TargetRect } from '../models/target-rect';

/** Name under which `targetRect` stores the target's rectangle in `middlewareData`. */
export const TARGET_RECT_MIDDLEWARE = 'targetRect';

/** Returns a middleware that exposes the reference element's viewport rectangle as `middlewareData.targetRect`. */
export const targetRect = (): Middleware => ({
  name: TARGET_RECT_MIDDLEWARE,
  fn: ({ rects }) => ({
    data: {
      top: rects.reference.y,
      left: rects.reference.x,
      width: rects.reference.width,
      height: rects.reference.height,
    } satisfies TargetRect,
  }),
});

/** Name under which `occlusion` stores whether the target is covered in `middlewareData`. */
export const OCCLUSION_MIDDLEWARE = 'occlusion';

/** Returns a middleware that reports, as `middlewareData.occlusion.isCovered`, whether another element (a drawer, a dialog) sits over the centre of the reference element. */
export const occlusion = (): Middleware => ({
  name: OCCLUSION_MIDDLEWARE,
  fn: ({ elements, rects }) => {
    const reference = elements.reference;
    if (
      !(reference instanceof Element) ||
      typeof document.elementFromPoint !== 'function'
    ) {
      return { data: { isCovered: false } };
    }
    /* Our own layers take no pointer events, so hit testing looks through them. */
    const hit = document.elementFromPoint(
      rects.reference.x + rects.reference.width / 2,
      rects.reference.y + rects.reference.height / 2,
    );
    const isCovered =
      hit != null && !reference.contains(hit) && !hit.contains(reference);
    return { data: { isCovered } };
  },
});

/** Returns the middleware that keeps a hint card next to its target, `extraGap` px further out for an arrow: below, else above, else beside it, inside the viewport. */
export const hintCardMiddleware = (extraGap = 0): Middleware[] => [
  /* Clear of the cut-out drawn SPOTLIGHT_PADDING px around the target. */
  offset(TARGET_GAP + SPOTLIGHT_PADDING + extraGap),
  flip({
    padding: VIEWPORT_MARGIN,
    fallbackPlacements: ['top-start', 'right-start', 'left-start'],
  }),
  shift({ padding: VIEWPORT_MARGIN }),
];
