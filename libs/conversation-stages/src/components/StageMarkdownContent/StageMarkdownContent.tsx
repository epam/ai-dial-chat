import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { MarkdownRenderer } from '@epam/ai-dial-conversation-messages';
import { type FC, memo } from 'react';
import type { StageTypography } from '../../models/StagesPanel';
import styles from '../StagesPanel/StagesPanel.module.scss';
import { StageCodeBlock } from './StageCodeBlock';

/** Props for the {@link StageMarkdownContent} markdown renderer used in stage content areas. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
  /** Typography configuration applied to text elements (`p`, `ul`, `ol`). */
  typography: StageTypography;
  /** Accessible label for the copy button inside code blocks. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
}

/** Renders stage content as formatted markdown, styled via CSS custom properties. */
export const StageMarkdownContent: FC<Props> = memo(
  ({ content, typography, copyAriaLabel = 'Copy' }) => (
    <MarkdownRenderer
      content={content}
      classNames={{
        p: mergeClasses(typography.fontClassName, styles.stageContent),
        ul: mergeClasses(typography.fontClassName, styles.stageContent),
        ol: mergeClasses(typography.fontClassName, styles.stageContent),
        codeInline: styles.codeInline,
        blockquote: styles.blockquote,
        link: styles.stageContent,
        tableCell: styles.tableCell,
        tableHeader: styles.tableHeader,
      }}
      components={{
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (!isBlock) {
            return (
              <code
                className={mergeClasses(
                  'px-1 py-0.5',
                  typography.codeClassName ?? 'rounded font-mono text-sm',
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
  ),
);
