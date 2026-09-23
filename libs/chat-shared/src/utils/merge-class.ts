import classNames from 'classnames';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * `shadow-chat-button` is the workspace theme's own `boxShadow` key
 * (tailwind.config.js), so tailwind-merge does not know it belongs to the
 * shadow group and leaves it beside a caller's `shadow-*`. Two box shadows
 * then reach the element and source order decides, which is exactly what a
 * host passing a class to override an elevation is trying to avoid.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { shadow: [{ shadow: ['chat-button'] }] } },
});

/** Merge class names (classnames → tailwind-merge). */
export function mergeClasses(...inputs: Parameters<typeof classNames>): string {
  return twMerge(classNames(...inputs));
}
