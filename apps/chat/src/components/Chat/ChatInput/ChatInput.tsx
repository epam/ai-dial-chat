import {
  Children,
  MutableRefObject,
  ReactNode,
  useEffect,
  useRef,
} from 'react';

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

    return () => {
      resizeObserver.disconnect();
    };
  }, [inputRef, onResize]);

  return (
    <div
      ref={inputRef}
      className="gradient-top-bottom absolute bottom-0 left-0 w-full pt-6 md:pt-2"
    >
      <div className="relative">
        {!Children.toArray(children).length &&
          !messageIsStreaming &&
          isMessagesPresented && (
            <button
              className="button button-chat"
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
          onStopConversation={onStopConversation}
        />
      )}
      <ChatInputFooter />
    </div>
  );
};
