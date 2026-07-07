import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { mergeClasses } from '../../utils/merge-class';
import styles from './Highlight.module.scss';

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
}

/** Renders text with the first occurrence of `query` wrapped in a highlight mark, with ellipsis truncation and a tooltip when overflowing. */
export const Highlight: FC<HighlightProps> = ({
  text,
  query,
  markClassName,
  className,
}) => {
  if (!query.trim()) {
    return (
      <DialEllipsisTooltip
        className={mergeClasses(
          '![-webkit-box-orient:vertical] ![-webkit-line-clamp:2] ![display:-webkit-box] ![white-space:normal]',
          className,
        )}
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
        >
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );

  return (
    <DialEllipsisTooltip
      className={mergeClasses(
        '![-webkit-box-orient:vertical] ![-webkit-line-clamp:2] ![display:-webkit-box] ![white-space:normal]',
        className,
      )}
      text={content}
    />
  );
};
