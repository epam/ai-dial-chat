import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { useCallback, useState, type FC } from 'react';
import { useDropzone } from 'react-dropzone';
import type { ConversationInputProps } from '../../models/ConversationInput';
import { Input } from '../Input/Input';
import styles from './ConversationInput.module.scss';

export const ConversationInput: FC<ConversationInputProps> = ({
  onSend,
  onUploadAttachment,
  onStop,
  isStreaming = false,
  onAttachmentsChange,
  message,
  placeholder = 'Type a prompt or use "/" to select one',
  welcomeText,
  styles: stylesProp,
  className,
  dropLabel = 'Drop files here',
  dropOverlayClassName = 'rounded',
  pasteTextThreshold,
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
  sendLabel,
  stopLabel,
  isInputDisabled = false,
  isTranscriptionSupported,
  onUploadAudio,
  onTranscribeAudio,
  micLabel,
  sendOnEnter,
  autoFocus,
  messageHistory,
}) => {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handleDropFilesConsumed = useCallback(() => {
    setPendingFiles([]);
  }, []);

  const { colors, typography } = stylesProp ?? {};

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (isInputDisabled) return;
      setPendingFiles(files);
    },
    noClick: true,
    noKeyboard: true,
    disabled: isInputDisabled,
  });

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
      {...getRootProps({
        style: cssVars,
        className: mergeClasses(
          'relative flex w-full flex-col items-center gap-6 px-4 py-5 desktop:p-5',
          className,
        ),
      })}
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
          message={message}
          onSend={onSend}
          onUploadAttachment={onUploadAttachment}
          onStop={onStop}
          isStreaming={isStreaming}
          onAttachmentsChange={onAttachmentsChange}
          placeholder={placeholder}
          colors={colors?.input}
          typography={typography?.input}
          pendingDropFiles={pendingFiles}
          onDropFilesConsumed={handleDropFilesConsumed}
          pasteTextThreshold={pasteTextThreshold}
          deployments={deployments}
          selectedDeploymentId={selectedDeploymentId}
          onDeploymentChange={onDeploymentChange}
          modelSelectorLabels={modelSelectorLabels}
          sendLabel={sendLabel}
          stopLabel={stopLabel}
          isInputDisabled={isInputDisabled}
          isTranscriptionSupported={isTranscriptionSupported}
          onUploadAudio={onUploadAudio}
          onTranscribeAudio={onTranscribeAudio}
          micLabel={micLabel}
          sendOnEnter={sendOnEnter}
          autoFocus={autoFocus}
          messageHistory={messageHistory}
        />
        {isDragActive && (
          <div
            className={mergeClasses(
              styles.dropOverlay,
              'pointer-events-none absolute inset-0 z-10 flex items-center justify-center border border-dashed',
              dropOverlayClassName,
            )}
          >
            <span
              className={typography?.dropLabelClassName ?? 'dial-tiny-text'}
            >
              {dropLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
