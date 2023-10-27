import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { Message, Playback } from '@/src/types/chat';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { ScrollDownButton } from './ScrollDownButton';

interface Props {
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
}
export const PlaybackControls = forwardRef(
  (
    { showScrollDownButton, onScrollDownClick }: Props,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    const dispatch = useAppDispatch();
    const isPlayback = useAppSelector(
      ConversationsSelectors.selectIsPlaybackSelectedConversations,
    );
    const selectedConversations = useAppSelector(
      ConversationsSelectors.selectSelectedConversations,
    );
    const [activeIndex, setActiveIndex] = useState<number>(
      () => selectedConversations[0].playback?.activePlaybackIndex ?? 0,
    );

    const handlePlaynextMessage = useCallback(() => {
      if (
        !selectedConversations[0].playback ||
        selectedConversations[0].playback.messagesStack.length - 1 <=
          activeIndex
      ) {
        return;
      }

      selectedConversations.forEach((conv) => {
        if (!conv.playback) {
          return;
        }
        const userMessage: Message = conv.playback?.messagesStack[activeIndex];

        const oldAssistantMessage: Message =
          conv.playback?.messagesStack[activeIndex + 1];

        const assistantMessage: Message = {
          ...oldAssistantMessage,
          content: '',
          role: 'assistant',
        };
        const updatedMessages = conv.messages.concat(
          userMessage,
          assistantMessage,
        );
        dispatch(
          ConversationsActions.updateConversation({
            id: conv.id,
            values: {
              messages: updatedMessages,
              isMessageStreaming: true,
            },
          }),
        );

        if (!conv.playback) {
          return;
        }
        const newAssistantMessage: Message =
          conv.playback.messagesStack[activeIndex + 1];

        const deletedMessage = updatedMessages.slice(0, activeIndex + 1);

        const updatedMessagesWithAssistant =
          deletedMessage.concat(newAssistantMessage);

        dispatch(
          ConversationsActions.updateConversation({
            id: conv.id,
            values: {
              messages: updatedMessagesWithAssistant,
              isMessageStreaming: false,
              playback: {
                ...(conv.playback as Playback),
                activePlaybackIndex: activeIndex + 2,
              },
            },
          }),
        );

        setActiveIndex((prevIndex) => prevIndex + 2);
      });
    }, [activeIndex, dispatch, selectedConversations]);

    const handlePrevMessage = useCallback(() => {
      if (activeIndex <= 0) {
        return;
      }
      selectedConversations.forEach((conv) => {
        const updatedMessages = conv.messages.slice(0, activeIndex - 2);
        dispatch(
          ConversationsActions.updateConversation({
            id: conv.id,
            values: {
              messages: updatedMessages,
              playback: {
                ...(conv.playback as Playback),
                activePlaybackIndex: activeIndex - 2,
              },
            },
          }),
        );
      });
      setActiveIndex((prevIndex) => prevIndex - 2);
    }, [activeIndex, dispatch, selectedConversations]);

    const handleCancelPlaybackMode = useCallback(() => {
      selectedConversations.forEach((conv) => {
        dispatch(
          ConversationsActions.updateConversation({
            id: conv.id,
            values: {
              playback: {
                ...(conv.playback as Playback),
                activePlaybackIndex: 0,
                isPlayback: false,
              },
            },
          }),
        );
      });
      setActiveIndex(0);
    }, [dispatch, selectedConversations]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (!isPlayback) {
          return;
        }
        if (
          !!selectedConversations[0].playback &&
          selectedConversations[0].playback.messagesStack.length - 1 >=
            activeIndex &&
          (e.key === 'Enter' ||
            e.key === 'ArrowDown' ||
            e.key === 'ArrowRight' ||
            e.key == ' ')
        ) {
          e.preventDefault();
          handlePlaynextMessage();
        } else if (
          activeIndex >= 0 &&
          (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
        ) {
          e.preventDefault();
          handlePrevMessage();
        }
      },
      [
        activeIndex,
        handlePlaynextMessage,
        handlePrevMessage,
        isPlayback,
        selectedConversations,
      ],
    );

    useEffect(() => {
      if (isPlayback) {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
          window.removeEventListener('keydown', handleKeyDown);
        };
      }
    }, [handleKeyDown, isPlayback]);

    return (
      <div
        ref={ref}
        className="absolute bottom-0 left-0 flex w-full items-center gap-1 border-transparent bg-gradient-to-b from-transparent via-gray-300 to-gray-300 p-6 dark:via-gray-900 dark:to-gray-900 md:pt-2"
      >
        <button
          onClick={handleCancelPlaybackMode}
          className="flex shrink-0 items-center gap-3 rounded border border-gray-400 bg-gray-200 p-3 hover:bg-gray-400 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600"
        >
          <IconPlayerStop size={24} className="shrink-0" />
        </button>

        {activeIndex > 0 && (
          <button
            onClick={handlePrevMessage}
            className="shrink-0 items-center gap-3 rounded border border-gray-400 bg-gray-200 p-3 hover:bg-gray-400 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600"
          >
            <IconPlayerPlay size={24} className="rotate-180" />
          </button>
        )}
        {!!selectedConversations[0].playback &&
          selectedConversations[0].playback.messagesStack.length - 1 >=
            activeIndex && (
            <>
              <div className="max-h-[150px] w-full overflow-y-auto whitespace-pre-wrap rounded border border-transparent bg-gray-100 px-3 py-2 text-left focus-visible:border-blue-500 focus-visible:outline-none dark:bg-gray-700">
                {selectedConversations[0].playback
                  ? selectedConversations[0].playback?.messagesStack[
                      activeIndex
                    ].content
                  : ''}
              </div>
              <button
                onClick={handlePlaynextMessage}
                className="flex shrink-0 items-center gap-3 rounded border border-gray-400 bg-gray-200 p-3 hover:bg-gray-400 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600"
              >
                <IconPlayerPlay size={24} className="shrink-0" />
              </button>
            </>
          )}

        {showScrollDownButton && (
          <ScrollDownButton onScrollDownClick={onScrollDownClick} />
        )}
      </div>
    );
  },
);

PlaybackControls.displayName = 'PlaybackControls';
