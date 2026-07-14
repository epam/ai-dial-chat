import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { MessageSourceProps } from '../../models/message-source';
import styles from './MessageSource.module.scss';

/** Styled pill button for a message source reference. */
export const MessageSource: FC<MessageSourceProps> = ({
  label,
  onClick,
  styles: sourceStyles,
}) => {
  const { colors, typography, className } = sourceStyles ?? {};
  const cssVars = buildCssVars({
    '--cm-source-bg': colors?.background,
    '--cm-source-border': colors?.border,
    '--cm-source-text': colors?.text,
    '--cm-source-bg-hover': colors?.backgroundHover,
    '--cm-source-border-hover': colors?.borderHover,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      style={cssVars}
      className={mergeClasses(
        styles.button,
        'relative flex h-6 items-center justify-center px-2',
        'border border-solid',
        'outline-none focus-visible:outline focus-visible:outline-1',
        'focus-visible:outline-offset-[3px]',
        'cursor-pointer whitespace-nowrap',
        typography?.fontClassName,
        className,
      )}
    >
      {label}
    </button>
  );
};
