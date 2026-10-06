import { MarkdownRenderer, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo, type ReactNode } from 'react';
import type { StageTypography } from '../../models/stages-props';
import styles from '../StagesPanel/StagesPanel.module.scss';
import { StageCodeBlock } from './StageCodeBlock';

/** Props for the {@link StageMarkdownContent} markdown renderer used in stage content areas. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
  /** Typography configuration applied to text elements (`p`, `ul`, `ol`). */
  typography?: StageTypography;
  /** Accessible label for the copy button inside code blocks. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
  /** Status announced after a code block has been copied. Defaults to `'Copied!'`. */
  copiedLabel?: string;
  /** Accessible label for a table's scrollable region. Defaults to `'Scrollable table'`. */
  tableScrollRegionAriaLabel?: string;
  /** Accessible label for a block formula's scrollable region. Defaults to `'Scrollable formula'`. */
  mathScrollRegionAriaLabel?: string;
}

/** Renders stage content as formatted markdown, styled via CSS custom properties. */
export const StageMarkdownContent: FC<Props> = memo(
  ({
    content,
    typography,
    copyAriaLabel = 'Copy',
    copiedLabel,
    tableScrollRegionAriaLabel,
    mathScrollRegionAriaLabel,
  }) => {
    const blockSpacing = 'mb-1.5 last:mb-0';
    const paragraphSpacing = 'mb-1.5';
    const heading = mergeClasses(
      typography?.headingClassName ?? 'dial-small-semi-text',
      styles.stageContent,
      blockSpacing,
    );

    return (
      <MarkdownRenderer
        content={content}
        tableScrollRegionAriaLabel={tableScrollRegionAriaLabel}
        mathScrollRegionAriaLabel={mathScrollRegionAriaLabel}
        classNames={{
          h1: heading,
          h2: heading,
          h3: heading,
          h4: heading,
          h5: heading,
          h6: heading,
          p: mergeClasses(
            typography?.contentClassName ?? 'dial-tiny-text',
            styles.stageContent,
            paragraphSpacing,
          ),
          ul: mergeClasses(
            typography?.contentClassName ?? 'dial-tiny-text',
            styles.stageContent,
            blockSpacing,
          ),
          ol: mergeClasses(
            typography?.contentClassName ?? 'dial-tiny-text',
            styles.stageContent,
            blockSpacing,
          ),
          strong: mergeClasses(
            typography?.strongClassName ??
              typography?.contentClassName ??
              'dial-tiny-text',
            styles.stageContent,
          ),
          codeInline: styles.codeInline,
          blockquote: mergeClasses(
            typography?.contentClassName ?? 'dial-tiny-text',
            styles.blockquote,
            blockSpacing,
          ),
          link: mergeClasses(
            typography?.contentClassName ?? 'dial-tiny-text',
            styles.stageContent,
          ),
          tableCell: mergeClasses(
            typography?.contentClassName ?? 'dial-tiny-text',
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
                    /* Inline (not inline-block) so the padding never grows the
                       line box past the surrounding text's line-height. */
                    'px-1 py-0.5',
                    typography?.codeClassName ?? 'dial-tiny-text rounded-md',
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
                blockClassName={typography?.codeBlockClassName}
                copyAriaLabel={copyAriaLabel}
                copiedLabel={copiedLabel}
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
