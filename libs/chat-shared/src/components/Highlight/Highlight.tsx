import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import styles from './Highlight.module.scss';

/** CSS custom-property overrides for the `Highlight` component. */
export interface HighlightColors {
  /** Highlighted match text color. */
  text?: string;
  /** Highlighted match background color. */
  background?: string;
}

/** Props for `Highlight`. */
export interface HighlightProps {
  /** Full text to display. */
  text: string;
  /** Search query; the first case-insensitive match is highlighted. */
  query: string;
  /** Optional class name for the highlighted segment. */
  markClassName?: string;
  /** Optional class name forwarded to the `DialEllipsisTooltip` container. */
  className?: string;
  /** Maximum number of lines to display before truncating. Use `1` for single-line ellipsis truncation (e.g. list rows). Defaults to `2`. */
  maxLines?: number;
  /** Color overrides applied as CSS custom properties. */
  colors?: HighlightColors;
}

/* Tailwind's JIT scanner only compiles class names that appear as complete
 * literal tokens in source, so the line count can't be interpolated into a
 * dynamic string here — each supported value is listed literally. */
const LINE_CLAMP_CLASS_NAMES: Record<number, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

const getClampClassName = (maxLines: number): string =>
  maxLines === 1
    ? '!truncate !whitespace-nowrap'
    : `${LINE_CLAMP_CLASS_NAMES[maxLines] ?? LINE_CLAMP_CLASS_NAMES[2]} !whitespace-normal`;

/** Renders text with the first occurrence of `query` wrapped in a highlight mark, with ellipsis truncation and a tooltip when overflowing. */
export const Highlight: FC<HighlightProps> = ({
  text,
  query,
  markClassName,
  className,
  maxLines = 2,
  colors,
}) => {
  const clampClassName = getClampClassName(maxLines);
  const cssVars = buildCssVars({
    '--hl-text': colors?.text,
    '--hl-bg': colors?.background,
  });

  if (!query.trim()) {
    return (
      <DialEllipsisTooltip
        className={mergeClasses(clampClassName, className)}
        text={text}
      />
    );
  }

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  const content =
    idx === -1 ? (
      text
    ) : (
      <>
        {text.slice(0, idx)}
        <mark
          className={[styles.mark, markClassName].filter(Boolean).join(' ')}
          style={cssVars}
        >
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );

  return (
    <DialEllipsisTooltip
      className={mergeClasses(clampClassName, className)}
      text={content}
    />
  );
};
