import { mergeClasses } from '@epam/chat-shared';
import { CSSProperties, type FC } from 'react';
import type { ConversationInputProps } from '../../models/ConversationInput.js';
import { Input } from '../Input/Input.js';
import styles from './ConversationInput.module.scss';

export const ConversationInput: FC<ConversationInputProps> = ({
  onSend,
  initialMessage = '',
  placeholder = 'Type a new prompt or use "/" to select one',
  welcomeText = 'Hello World, good day for prompting!',
  colors,
  typography,
  className,
}) => {
  const cssVars = {
    ...(colors?.background && { '--ci-root-bg': colors.background }),
    ...(colors?.welcomeText && { '--ci-welcome-color': colors.welcomeText }),
    ...(!typography?.welcomeClassName &&
      typography?.welcomeFontSize && {
        '--ci-welcome-font-size': typography.welcomeFontSize,
      }),
    ...(!typography?.welcomeClassName &&
      typography?.welcomeFontWeight && {
        '--ci-welcome-font-weight': String(typography.welcomeFontWeight),
      }),
    ...(!typography?.welcomeClassName &&
      typography?.welcomeLineHeight && {
        '--ci-welcome-line-height': String(typography.welcomeLineHeight),
      }),
  } as CSSProperties;

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'relative flex w-full flex-col items-center gap-6 p-4',
        className,
      )}
    >
      {welcomeText && (
        <h1
          className={mergeClasses(
            styles.welcome,
            'm-0 text-center',
            typography?.welcomeClassName,
          )}
        >
          {welcomeText}
        </h1>
      )}
      <Input
        initialMessage={initialMessage}
        onSend={onSend}
        placeholder={placeholder}
        colors={colors?.input}
        typography={typography?.input}
      />
    </div>
  );
};
