import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { useCallback, useState, type FC } from 'react';
import { useDragDrop } from '../../hooks/useDragDrop.js';
import type { ConversationInputProps } from '../../models/ConversationInput.js';
import { buildCssVars } from '../../utils/buildCssVars.js';
import { Input } from '../Input/Input.js';
import styles from './ConversationInput.module.scss';

export const ConversationInput: FC<ConversationInputProps> = ({
  onSend,
  onStop,
  isStreaming = false,
  onAttachmentsChange,
  initialMessage = '',
  placeholder = 'Type a new prompt or use "/" to select one',
  welcomeText,
  colors,
  typography,
  className,
  dropLabel = 'Drop files here',
  pasteTextThreshold,
}) => {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handleDropFiles = useCallback((files: File[]) => {
    setPendingFiles(files);
  }, []);

  const handleDropFilesConsumed = useCallback(() => {
    setPendingFiles([]);
  }, []);

  const { dragHandlers, isDragOver } = useDragDrop(handleDropFiles);

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
      ? typography?.welcomeFontWeight
      : undefined,
    '--ci-welcome-line-height': noCustomClass
      ? typography?.welcomeLineHeight
      : undefined,
  });

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'relative flex w-full flex-col items-center gap-6 p-4',
        className,
      )}
      {...dragHandlers}
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
      <div className="relative w-full max-w-[748px]">
        <Input
          initialMessage={initialMessage}
          onSend={onSend}
          onStop={onStop}
          isStreaming={isStreaming}
          onAttachmentsChange={onAttachmentsChange}
          placeholder={placeholder}
          colors={colors?.input}
          typography={typography?.input}
          pendingDropFiles={pendingFiles}
          onDropFilesConsumed={handleDropFilesConsumed}
          pasteTextThreshold={pasteTextThreshold}
        />
        {isDragOver && (
          <div
            className={mergeClasses(
              styles.dropOverlay,
              'pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded border border-dashed',
            )}
          >
            <span className="dial-tiny-text">{dropLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};
