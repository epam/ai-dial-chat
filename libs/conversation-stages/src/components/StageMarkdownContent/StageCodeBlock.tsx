import { copyToClipboard, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import styles from '../StagesPanel/StagesPanel.module.scss';

interface Props {
  /** Raw code text to copy. */
  children: ReactNode;
  /** Language class from react-markdown (e.g. `language-json`). */
  codeClassName?: string;
  /** Typography class applied to the `<pre>` block. Defaults to `'dial-code-text'`. */
  blockClassName?: string;
  /** Accessible label for the copy button. */
  copyAriaLabel: string;
}

/** Code block with an inline copy button in the top-end corner. */
export const StageCodeBlock: FC<Props> = ({
  children,
  codeClassName,
  blockClassName = 'dial-code-text',
  copyAriaLabel,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    const text =
      typeof children === 'string' ? children : String(children ?? '');
    void copyToClipboard(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsCopied(true);
    timeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
  }, [children]);

  return (
    <pre
      className={mergeClasses(
        'relative max-h-[300px] overflow-auto rounded border p-3',
        blockClassName,
        styles.codeBlock,
      )}
    >
      <GhostIconButton
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
        className="absolute end-2 top-2"
      />
      {/* Family is inherited from the `<pre>`'s typography class. A monospace
       * utility here would replace the themed face with the generic stack. */}
      <code className={codeClassName}>{children}</code>
    </pre>
  );
};
