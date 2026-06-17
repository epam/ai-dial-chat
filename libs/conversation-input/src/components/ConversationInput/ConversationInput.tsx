import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import type { ConversationInputProps } from '../../models/ConversationInput';
import { Input } from '../Input/Input';
import styles from './ConversationInput.module.scss';

export const ConversationInput: FC<ConversationInputProps> = ({
  isStreaming = false,
  placeholder = 'Type a prompt or use "/" to select one',
  welcomeText,
  styles: stylesProp,
  className,
  isInputDisabled = false,
  ...inputProps
}) => {
  const { colors, typography } = stylesProp ?? {};

  const noCustomClass = !typography?.welcomeClassName;
  const cssVars = buildCssVars({
    '--ci-root-bg': colors?.background,
    '--ci-welcome-color': colors?.welcomeText,
    '--ci-welcome-font-family': noCustomClass
      ? typography?.welcomeFontFamily
      : undefined,
    '--ci-welcome-font-size': noCustomClass
      ? typography?.welcomeFontSize
      : undefined,
    '--ci-welcome-font-weight': noCustomClass
      ? typography?.welcomeFontWeight?.toString()
      : undefined,
    '--ci-welcome-line-height': noCustomClass
      ? typography?.welcomeLineHeight?.toString()
      : undefined,
  });

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'relative flex w-full flex-col items-center gap-6 px-4 py-5 desktop:p-5',
        className,
      )}
    >
      {welcomeText && (
        <h1
          className={mergeClasses(
            styles.welcome,
            noCustomClass && styles.welcomeFont,
            'm-0 text-center',
            typography?.welcomeClassName,
          )}
        >
          {welcomeText}
        </h1>
      )}
      <div className="relative w-full max-w-[748px]">
        <Input
          placeholder={placeholder}
          isStreaming={isStreaming}
          isInputDisabled={isInputDisabled}
          {...inputProps}
          colors={colors?.input}
          typography={typography?.input}
        />
      </div>
    </div>
  );
};
