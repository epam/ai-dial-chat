import {
  MutableRefObject,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import classNames from 'classnames';

import { useFilePaste } from '@/src/hooks/useFilePaste';
import { useUploadFilesHandler } from '@/src/hooks/useUploadFilesHandler';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ChatInputMessage } from './ChatInputMessage';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Message } from '@epam/ai-dial-shared';

interface Props {
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  isShowInput: boolean;
  isWideLayout: boolean;
  isLastMessageError: boolean;
  showReplayControls: boolean;
  children?: ReactNode;
  onSend: (message: Message) => void;
  onScrollDownClick: () => void;
  onStopConversation: () => void;
  onResize: (height: number) => void;
  onRegenerate: () => void;
}

export const ChatInput = Inversify.register(
  'ChatInput',
  ({
    isLastMessageError,
    textareaRef,
    showScrollDownButton,
    isShowInput,
    isWideLayout,
    showReplayControls,
    children,
    onSend,
    onRegenerate,
    onScrollDownClick,
    onStopConversation,
    onResize,
  }: Props) => {
    const messageIsStreaming = useAppSelector(
      ConversationsSelectors.selectIsConversationsStreaming,
    );
    const availableAttachmentsTypes = useAppSelector(
      ConversationsSelectors.selectAvailableAttachmentsTypes,
    );
    const maximumAttachmentsAmount = useAppSelector(
      ConversationsSelectors.selectMaximumAttachmentsAmount,
    );
    const canAttachFiles = useAppSelector(
      ConversationsSelectors.selectCanAttachFile,
    );

    const inputRef = useRef<HTMLDivElement | null>(null);

    const handleUploadFiles = useUploadFilesHandler(
      getQuickAttachmentsSavingPath(),
      maximumAttachmentsAmount,
      availableAttachmentsTypes,
    );

    const handlePaste = useCallback(
      (files: File[]) => {
        if (canAttachFiles) handleUploadFiles(files);
      },
      [canAttachFiles, handleUploadFiles],
    );

    useFilePaste(textareaRef, handlePaste);

    useEffect(() => {
      if (!inputRef) {
        return;
      }

      const resizeObserver = new ResizeObserver(() => {
        inputRef.current?.clientHeight &&
          onResize(inputRef.current.clientHeight);
      });
      inputRef.current && resizeObserver.observe(inputRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [inputRef, onResize]);

    return (
      <div
        ref={inputRef}
        className={classNames('w-full pt-3 md:pt-5', {
          '!pt-10': isWideLayout,
        })}
      >
        <div className="relative">{!messageIsStreaming && children}</div>
        {isShowInput && (
          <ChatInputMessage
            isLastMessageError={isLastMessageError}
            onRegenerate={onRegenerate}
            textareaRef={textareaRef}
            showScrollDownButton={showScrollDownButton}
            onScrollDownClick={onScrollDownClick}
            onSend={onSend}
            onStopConversation={onStopConversation}
            showReplayControls={showReplayControls}
          />
        )}
      </div>
    );
  },
);
