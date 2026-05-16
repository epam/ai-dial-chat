import { mergeClasses } from '@epam/chat-shared';
import { CSSProperties, type FC, KeyboardEvent, useState } from 'react';
import type { InputProps } from '../../models/Input.js';
import styles from './Input.module.scss';
import { SendButton } from './SendButton.js';

export const Input: FC<InputProps> = ({
  initialMessage = '',
  onSend,
  onChange,
  placeholder = 'Type a message...',
  colors,
  typography,
  className,
}) => {
  const cssVars = {
    ...(colors?.background && { '--ci-bg': colors.background }),
    ...(colors?.text && { '--ci-text': colors.text }),
    ...(colors?.border && { '--ci-border': colors.border }),
    ...(colors?.borderFocus && { '--ci-border-focus': colors.borderFocus }),
    ...(colors?.placeholder && { '--ci-placeholder': colors.placeholder }),
    ...(colors?.sendBackground && { '--ci-send-bg': colors.sendBackground }),
    ...(colors?.sendText && { '--ci-send-text': colors.sendText }),
    ...(typography?.fontFamily && {
      '--ci-font-family': typography.fontFamily,
    }),
    ...(typography?.fontSize && { '--ci-font-size': typography.fontSize }),
    ...(typography?.fontWeight && {
      '--ci-font-weight': String(typography.fontWeight),
    }),
    ...(typography?.lineHeight && {
      '--ci-line-height': typography.lineHeight,
    }),
  } as CSSProperties;

  const [message, setMessage] = useState(initialMessage);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend?.(message);
      setMessage('');
    }
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        styles.wrapper,
        'flex h-[56px] w-[748px] items-end gap-2 rounded border px-3 py-2',
        className,
      )}
    >
      {/* plus button */}
      {/* input */}
      {/* select1 */}
      {/* select2 */}

      <textarea
        className={mergeClasses(
          styles.textarea,
          'flex-1 resize-none bg-transparent outline-none',
        )}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          onChange?.(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
      />
      {message.trim() && <SendButton onSend={() => onSend?.(message)} />}
    </div>
  );
};
