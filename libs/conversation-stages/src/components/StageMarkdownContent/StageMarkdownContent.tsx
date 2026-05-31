import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { MarkdownRenderer } from '@epam/ai-dial-conversation-messages';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import {
  type FC,
  type ReactNode,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react';
import styles from '../StagesPanel/StagesPanel.module.scss';

interface CodeBlockProps {
  /** Raw code text to copy. */
  children: ReactNode;
  /** Language class from react-markdown (e.g. `language-json`). */
  codeClassName?: string;
  /** Accessible label for the copy button. */
  copyAriaLabel: string;
}

/** Code block with an inline copy button in the top-right corner. */
const StageCodeBlock: FC<CodeBlockProps> = ({
  children,
  codeClassName,
  copyAriaLabel,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    const text =
      typeof children === 'string' ? children : String(children ?? '');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsCopied(true);
    timeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
  }, [children]);

  return (
    <pre
      className={mergeClasses(
        'relative max-h-[300px] overflow-auto rounded border p-3 text-sm',
        styles.codeBlock,
      )}
    >
      <DialGhostIconButton
        size={ElementSize.Small}
        icon={
          isCopied ? (
            <IconCheck
              size={DIAL_ICON_SIZE.SM}
              className={styles.iconSecondary}
            />
          ) : (
            <IconCopy
              size={DIAL_ICON_SIZE.SM}
              className={styles.iconSecondary}
            />
          )
        }
        aria-label={copyAriaLabel}
        onClick={handleCopy}
        className="absolute right-2 top-2"
      />
      <code className={mergeClasses('font-mono', codeClassName)}>
        {children}
      </code>
    </pre>
  );
};

/** Props for the {@link StageMarkdownContent} markdown renderer used in stage content areas. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
  /** Typography utility class applied to text elements. */
  typographyClassName: string;
  /** Accessible label for the copy button inside code blocks. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
}

/** Renders stage content as formatted markdown, styled via CSS custom properties. */
export const StageMarkdownContent: FC<Props> = memo(
  ({ content, typographyClassName, copyAriaLabel = 'Copy' }) => (
    <MarkdownRenderer
      content={content}
      classNames={{
        p: mergeClasses(typographyClassName, styles.stageContent),
        ul: mergeClasses(typographyClassName, styles.stageContent),
        ol: mergeClasses(typographyClassName, styles.stageContent),
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
                  'rounded px-1 py-0.5 font-mono text-sm',
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
