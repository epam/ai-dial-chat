import { FC } from 'react';
import styles from './Highlight.module.scss';

/** Props for Highlight. */
export interface HighlightProps {
  /** Full text to display. */
  text: string;
  /** Search query; the first case-insensitive match is highlighted. */
  query: string;
  /** Optional class name for the highlighted segment. */
  markClassName?: string;
}

// TODO: use for other text elements in the catalog, like folder paths and card titles, to surface matches more clearly. Consider adding a tooltip for long texts that are truncated with ellipsis.
/** Renders text with the first occurrence of query wrapped in a highlight mark. */
export const Highlight: FC<HighlightProps> = ({
  text,
  query,
  markClassName,
}) => {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={[styles.mark, markClassName].filter(Boolean).join(' ')}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
};
