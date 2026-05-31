import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { MarkdownRenderer } from '@epam/ai-dial-conversation-messages';
import { type FC, memo } from 'react';
import styles from '../StagesPanel/StagesPanel.module.scss';

/** Props for the {@link StageMarkdownContent} markdown renderer used in stage content areas. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
  /** Typography utility class applied to text elements. */
  typographyClassName: string;
}

/** Renders stage content as formatted markdown, styled via CSS custom properties. */
export const StageMarkdownContent: FC<Props> = memo(
  ({ content, typographyClassName }) => (
    <div className="flex flex-col gap-3">
      <MarkdownRenderer
        content={content}
        classNames={{
          p: mergeClasses(typographyClassName, styles.stageContent),
          ul: mergeClasses(typographyClassName, styles.stageContent),
          ol: mergeClasses(typographyClassName, styles.stageContent),
          codeBlock: mergeClasses(
            'border max-h-[300px] overflow-auto',
            styles.codeBlock,
          ),
          codeInline: styles.codeInline,
          blockquote: styles.blockquote,
          link: styles.stageContent,
          tableCell: styles.tableCell,
          tableHeader: styles.tableHeader,
        }}
      />
    </div>
  ),
);
