import type { FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import type { MarkdownRendererColors } from './MarkdownRenderer';
import styles from './MarkdownRenderer.module.scss';

/** Props for {@link ThinkingShimmer}. */
export interface ThinkingShimmerProps {
  /** Text rendered with the shimmer animation. */
  label: string;
  /** Gradient color overrides applied as CSS custom properties. */
  colors?: Pick<
    MarkdownRendererColors,
    'thinkingPrimary' | 'thinkingSecondary'
  >;
}

/**
 * The "thinking" placeholder both message renderers show while a stream has
 * started but no content has arrived yet. Owns the mapping from the public
 * color props to the gradient's CSS variables — `thinkingPrimary` drives
 * `--cm-thinking-inverted` — so that mapping exists in one place.
 */
export const ThinkingShimmer: FC<ThinkingShimmerProps> = ({
  label,
  colors,
}) => (
  <span
    className={styles.thinking}
    style={buildCssVars({
      '--cm-thinking-inverted': colors?.thinkingPrimary,
      '--cm-thinking-secondary': colors?.thinkingSecondary,
    })}
  >
    {label}
  </span>
);
