import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { CSSProperties, FC } from 'react';
import type { MessageSourceProps } from '../../models/MessageSource.js';
import styles from './MessageSource.module.scss';

// TODO: review after usage in MessageActions
export const MessageSource: FC<MessageSourceProps> = ({
  label,
  className,
  onClick,
  colors,
  typography,
}) => {
  const cssVars = {
    ...(colors?.background && { '--cm-source-bg': colors.background }),
    ...(colors?.border && { '--cm-source-border': colors.border }),
    ...(colors?.text && { '--cm-source-text': colors.text }),
    ...(colors?.backgroundHover && {
      '--cm-source-bg-hover': colors.backgroundHover,
    }),
    ...(colors?.borderHover && {
      '--cm-source-border-hover': colors.borderHover,
    }),
    ...(!typography?.fontClassName &&
      typography?.fontSize && { '--cm-source-font-size': typography.fontSize }),
    ...(!typography?.fontClassName &&
      typography?.fontWeight && {
        '--cm-source-font-weight': String(typography.fontWeight),
      }),
    ...(!typography?.fontClassName &&
      typography?.lineHeight && {
        '--cm-source-line-height': typography.lineHeight,
      }),
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      style={cssVars}
      className={mergeClasses(
        styles.button,
        'relative flex h-6 items-center justify-center px-2',
        'rounded-[4px] border border-solid',
        'outline-none focus-visible:outline focus-visible:outline-1',
        'focus-visible:outline-offset-[3px] focus-visible:outline-[var(--stroke-focus,#EEF1F7)]',
        'cursor-pointer whitespace-nowrap',
        typography?.fontClassName,
        className,
      )}
    >
      {label}
    </button>
  );
};

export default MessageSource;
