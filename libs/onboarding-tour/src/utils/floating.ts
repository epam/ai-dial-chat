import { flip, offset, shift, type Middleware } from '@floating-ui/react';
import { TARGET_GAP, VIEWPORT_MARGIN } from '../constants/layout';
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

/** Returns the middleware that keeps a hint card next to its target: below, else above, else beside it, inside the viewport. */
export const hintCardMiddleware = (): Middleware[] => [
  offset(TARGET_GAP),
  flip({
    padding: VIEWPORT_MARGIN,
    fallbackPlacements: ['top-start', 'right-start', 'left-start'],
  }),
  shift({ padding: VIEWPORT_MARGIN }),
];
