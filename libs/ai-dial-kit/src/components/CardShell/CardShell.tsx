import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import styles from './CardShell.module.scss';

/** Props for the {@link CardShell} component — every standard `<article>` attribute, so callers wire `role`, `aria-label`, `onClick`, `onKeyDown`, `style`, etc. directly. */
export type CardShellProps = ComponentPropsWithoutRef<'article'>;

/**
 * Shared elevated-card shell used as the root of browse-grid cards
 * (Catalog, Favorites, Scheduled Tasks): rounded corners, padding, a
 * vertical gap between children, background, resting shadow, a hover lift
 * with a stronger shadow, and a `prefers-reduced-motion` fallback that
 * disables the transform/transition. Callers render their own header/body/
 * footer content as `children` and pass an extra `className` for
 * card-specific layout (e.g. a fixed height, a horizontal flex direction,
 * a selected-state border color) — it is merged after the shell's own
 * defaults, so it can override them.
 */
export const CardShell: FC<CardShellProps> = ({
  className,
  children,
  ...rest
}) => (
  <article
    className={mergeClasses(
      'relative flex flex-col gap-[14px] rounded-[20px] border-2 border-transparent p-[22px]',
      styles.card,
      className,
    )}
    {...rest}
  >
    {children}
  </article>
);
