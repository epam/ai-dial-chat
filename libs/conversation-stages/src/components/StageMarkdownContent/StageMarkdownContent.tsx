import { MarkdownRenderer, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo, type ReactNode } from 'react';
import type { StageTypography } from '../../models/stages-props';
import styles from '../StagesPanel/StagesPanel.module.scss';
import { StageCodeBlock } from './StageCodeBlock';

/** Props for the {@link StageMarkdownContent} markdown renderer used in stage content areas. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
  /**
   * Typography configuration — uses `contentClassName` (smaller than the
   * row name) for every content text element (`p`, `ul`, `ol`,
   * `blockquote`, `a`, table cells), `strongClassName` (defaulting to
   * `contentClassName` itself) for bold markdown so `**emphasis**` in
   * tool/stage output doesn't render heavier than the quiet, secondary tone
   * of the rest of the content, and `headingClassName` (defaulting to the
   * DS's smallest heading style) applied uniformly to every heading level
   * so headings stay small inside a stage instead of scaling up to `h1`
   * size.
   */
  typography: StageTypography;
  /** Accessible label for the copy button inside code blocks. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
}

/** Renders stage content as formatted markdown, styled via CSS custom properties. */
export const StageMarkdownContent: FC<Props> = memo(
  ({ content, typography, copyAriaLabel = 'Copy' }) => {
    /*
     * Block-level markdown elements (p, ul, ol, blockquote, headings) get no
     * vertical margin from the shared renderer's defaults — only `li` does.
     * Without `mb-1.5` here, consecutive short blocks (e.g. a blockquote
     * label immediately followed by its value paragraph) render with zero
     * gap and read as one dense, stacked wall of text.
     */
    const blockSpacing = 'mb-1.5 last:mb-0';
    /*
     * Paragraphs always keep their trailing space, even as the last block —
     * unlike `blockSpacing`, there's no `last:mb-0` here, so a step whose
     * content is just a single paragraph still gets padding below it
     * instead of sitting flush against the container's own edge.
     */
    const paragraphSpacing = 'mb-1.5';
    const heading = mergeClasses(
      typography.headingClassName ?? 'dial-small-semi-text',
      styles.stageContent,
      blockSpacing,
    );

    return (
      <MarkdownRenderer
        content={content}
        classNames={{
          h1: heading,
          h2: heading,
          h3: heading,
          h4: heading,
          h5: heading,
          h6: heading,
          p: mergeClasses(
            typography.contentClassName,
            styles.stageContent,
            paragraphSpacing,
          ),
          ul: mergeClasses(
            typography.contentClassName,
            styles.stageContent,
            blockSpacing,
          ),
          ol: mergeClasses(
            typography.contentClassName,
            styles.stageContent,
            blockSpacing,
          ),
          strong: mergeClasses(
            typography.strongClassName ?? typography.contentClassName,
            styles.stageContent,
          ),
          codeInline: styles.codeInline,
          blockquote: mergeClasses(
            typography.contentClassName,
            styles.blockquote,
            blockSpacing,
          ),
          link: mergeClasses(typography.contentClassName, styles.stageContent),
          tableCell: mergeClasses(
            typography.contentClassName,
            styles.tableCell,
          ),
        }}
        components={{
          code: ({
            children,
            className,
          }: {
            children?: ReactNode;
            className?: string;
          }) => {
            const isBlock = className?.includes('language-');
            if (!isBlock) {
              return (
                <code
                  className={mergeClasses(
                    /*
                     * inline-block: a plain inline element doesn't reserve
                     * vertical space for its own padding/border in the line
                     * box, so the top/bottom border renders but gets
                     * visually clipped by the surrounding line content.
                     */
                    'inline-block px-1.5 py-1',
                    typography.codeClassName ?? 'rounded-md font-mono text-sm',
                    styles.codeInline,
                  )}
                >
                  {children}
                </code>
              );
            }
            return (
              <StageCodeBlock
                codeClassName={className}
                copyAriaLabel={copyAriaLabel}
              >
                {children}
              </StageCodeBlock>
            );
          },
        }}
      />
    );
  },
);
