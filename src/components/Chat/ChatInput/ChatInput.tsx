import { IconPlayerStop } from '@tabler/icons-react';
import { MutableRefObject, ReactNode, useEffect, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import { Message } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import RefreshCWAlt from '../../../../public/images/icons/refresh-cw-alt.svg';
import { ChatInputFooter } from './ChatInputFooter';
import { ChatInputMessage } from './ChatInputMessage';

interface Props {
  onSend: (message: Message) => void;
  onRegenerate: () => void;
  onScrollDownClick: () => void;
  onStopConversation: () => void;
  onResize: (height: number) => void;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  isMessagesPresented: boolean;
  isShowInput: boolean;
  children?: ReactNode;
}

export const ChatInput = ({
  onSend,
  onRegenerate,
  onScrollDownClick,
  onStopConversation,
  onResize,
  textareaRef,
  showScrollDownButton,
  isMessagesPresented,
  isShowInput,
  children,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const inputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inputRef) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      inputRef.current?.clientHeight && onResize(inputRef.current.clientHeight);
    });
    inputRef.current && resizeObserver.observe(inputRef.current);

    () => {
      resizeObserver.disconnect();
    };
  }, [inputRef, onResize]);

  return (
    <div
      ref={inputRef}
      className="absolute bottom-0 left-0 w-full border-transparent bg-gradient-to-b from-transparent via-gray-300 to-gray-300 pt-6 md:pt-2"
    >
      <div className="relative">
        {messageIsStreaming && (
          <button
            className="border-gray-400 hover:bg-layer-4 absolute inset-x-0 -top-14 mx-auto mb-3 flex w-fit items-center gap-3 rounded border bg-layer-2 p-3"
            onClick={onStopConversation}
            data-qa="stop-generating"
          >
            <IconPlayerStop
              size={18}
              className="text-secondary"
              strokeWidth="1.5"
            />{' '}
            {t('Stop generating')}
          </button>
        )}

        {!children && !messageIsStreaming && isMessagesPresented && (
          <button
            className="border-gray-400 hover:bg-layer-4 absolute inset-x-0 -top-14 mx-auto mb-3 flex w-fit items-center gap-3 rounded border bg-layer-2 p-3"
            onClick={onRegenerate}
            data-qa="regenerate"
          >
            <span className="text-secondary">
              <RefreshCWAlt width={18} height={18} />
            </span>
            {t('Regenerate response')}
          </button>
        )}
        {!messageIsStreaming && children}
      </div>
      {isShowInput && (
        <ChatInputMessage
          textareaRef={textareaRef}
          showScrollDownButton={showScrollDownButton}
          onScrollDownClick={onScrollDownClick}
          onSend={onSend}
        />
      )}
      <ChatInputFooter />
    </div>
  );
};
