import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import type { ConversationInputProps } from '../../models/ConversationInput';
import { Input } from '../Input/Input';
import styles from './ConversationInput.module.scss';

/** Root conversation input: wraps the `Input` component with a welcome message and style override support. */
export const ConversationInput: FC<ConversationInputProps> = ({
  isStreaming = false,
  placeholder = 'Type a prompt or use "/" to select one',
  welcomeText,
  styles: stylesProp,
  className,
  inputClassName,
  isInputDisabled = false,
  ...inputProps
}) => {
  const { colors, typography } = stylesProp ?? {};

  const cssVars = buildCssVars({
    '--ci-welcome-color': colors?.welcomeText,
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
            'm-0 text-center',
            typography?.welcomeClassName || 'dial-display2-text',
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
          className={inputClassName}
          colors={colors?.input}
          typography={typography?.input}
        />
      </div>
    </div>
  );
};
