import classNames from 'classnames';
import { twMerge } from 'tailwind-merge';

/** Merge class names (classnames → tailwind-merge). */
export function mergeClasses(...inputs: Parameters<typeof classNames>): string {
  return twMerge(classNames(...inputs));
}
