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
