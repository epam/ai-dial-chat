import { memo, type FC } from 'react';
import { useStreamedMarkdownContent } from '../../hooks/useStreamedMarkdownContent';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import type {
  MarkdownRendererClassNames,
  MarkdownRendererColors,
} from './MarkdownRenderer';
import styles from './MarkdownRenderer.module.scss';

/** Props for {@link PlainTextRenderer}. */
export interface PlainTextRendererProps {
  /** Message text. Rendered verbatim — never parsed as Markdown or HTML. */
  content: string;
  /** Classes applied to the renderer root. */
  containerClassName?: string;
  /** When true, appended content is revealed gradually for smoother streaming updates. */
  isStreaming?: boolean;
  /** Reveal speed used while `isStreaming` is true. Defaults to 120 characters per second. */
  streamCharactersPerSecond?: number;
  /**
   * Typography classes. Only `p` is read — the single paragraph the renderer
   * emits — so the same object a Markdown message is styled with keeps both
   * formats on one type scale.
   */
  classNames?: Pick<MarkdownRendererClassNames, 'p'>;
  /**
   * Label shown with a shimmer animation while `isStreaming` is true and no
   * content has arrived yet. Defaults to `'Thinking'`.
   */
  thinkingLabel?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: Pick<
    MarkdownRendererColors,
    'thinkingPrimary' | 'thinkingSecondary'
  >;
}

/** Stable empty classNames object used as the default when no `classNames` prop is passed. */
const EMPTY_CLASS_NAMES: Pick<MarkdownRendererClassNames, 'p'> = {};

/**
 * Renders message text as plain text: no Markdown pipeline, no raw HTML, no
 * syntax highlighting. The text is a React text child, so it is escaped by
 * construction — a table, a heading, or `**bold**` reaches the reader exactly
 * as the model emitted it, which is what a conversation's `plain_text`
 * response format promises.
 *
 * Lives beside {@link MarkdownRenderer} because it is the other half of the
 * same choice: both render an assistant message body, and both are selected
 * by `MDMessageViewer` from the conversation's response format.
 */
export const PlainTextRenderer: FC<PlainTextRendererProps> = memo(
  ({
    content,
    containerClassName,
    isStreaming,
    streamCharactersPerSecond,
    classNames = EMPTY_CLASS_NAMES,
    thinkingLabel = 'Thinking',
    colors,
  }) => {
    const displayedContent = useStreamedMarkdownContent(
      content,
      isStreaming,
      streamCharactersPerSecond,
    );

    const cssVars = buildCssVars({
      '--cm-thinking-inverted': colors?.thinkingPrimary,
      '--cm-thinking-secondary': colors?.thinkingSecondary,
    });

    if (isStreaming && !displayedContent) {
      return (
        <span className={styles.thinking} style={cssVars}>
          {thinkingLabel}
        </span>
      );
    }

    /*
     * The paragraph wrapper keeps the element shape a Markdown body has — a
     * container with block-level children — so host selectors that target the
     * body's first block (e.g. the message bubble's first-line indent) apply
     * to either format unchanged.
     */
    return (
      <div style={cssVars} className={containerClassName}>
        <p
          className={mergeClasses(
            classNames.p,
            'whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
          )}
        >
          {displayedContent}
        </p>
      </div>
    );
  },
);
