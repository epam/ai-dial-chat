import { MarkdownCodeBlock, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, type ReactNode } from 'react';
import styles from '../StagesPanel/StagesPanel.module.scss';

interface Props {
  /** Raw code text to copy. */
  children: ReactNode;
  /** Language class from react-markdown (e.g. `language-json`). */
  codeClassName?: string;
  /** Typography class applied to the fenced code block. Defaults to `'dial-code-text'`. */
  blockClassName?: string;
  /** Accessible label for the copy button. */
  copyAriaLabel: string;
}

/** Adapts stage markdown code blocks to the shared markdown code-block UI. */
export const StageCodeBlock: FC<Props> = ({
  children,
  codeClassName,
  blockClassName = 'dial-code-text',
  copyAriaLabel,
}) => {
  const language = codeClassName?.replace(/^language-/, '') ?? '';
  const value =
    typeof children === 'string' ? children : String(children ?? '');

  return (
    <MarkdownCodeBlock
      language={language}
      value={value}
      codeClassName={blockClassName}
      containerClassName={mergeClasses(styles.codeBlock, blockClassName)}
      copyLabel={copyAriaLabel}
      hideDownload
    />
  );
};
