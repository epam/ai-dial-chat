import { IconPlayerPlay } from '@tabler/icons-react';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { FooterMessage } from '@/src/components/Chat/FooterMessage';
import { ScrollDownButton } from '@/src/components/Chat/ScrollDownButton';

interface Props {
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onResize: (height: number) => void;
  nextMessageBoxRef: MutableRefObject<HTMLDivElement | null>;
}
export const PlaybackControls = ({
  onScrollDownClick,
  onResize,
  nextMessageBoxRef,
  showScrollDownButton,
}: Props) => {
  const dispatch = useAppDispatch();
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const isMessageStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const activeIndex = useAppSelector(
    ConversationsSelectors.selectPlaybackActiveIndex,
  );

  const controlsContainerRef = useRef<HTMLDivElement | null>(null);

  const isActiveIndex = typeof activeIndex === 'number';

  const isNextMessageInStack = useMemo(() => {
    return (
      selectedConversations.length &&
      !!selectedConversations[0].playback &&
      isActiveIndex &&
      activeIndex >= 0 &&
      selectedConversations[0].playback.messagesStack.length - 1 >= activeIndex
    );
  }, [activeIndex, isActiveIndex, selectedConversations]);

  const activeMessageContent = useMemo(() => {
    if (
      isActiveIndex &&
      isNextMessageInStack &&
      selectedConversations.length &&
      selectedConversations[0].playback &&
      selectedConversations[0].playback.messagesStack[activeIndex].content
    ) {
      return selectedConversations[0].playback.messagesStack[activeIndex]
        .content;
    }

    return '';
  }, [activeIndex, isActiveIndex, isNextMessageInStack, selectedConversations]);

  const handlePlaynextMessage = useCallback(() => {
    if (isMessageStreaming || !isNextMessageInStack) {
      return;
    }

    dispatch(ConversationsActions.playbackNextMessageStart());
  }, [dispatch, isMessageStreaming, isNextMessageInStack]);

  const handlePrevMessage = useCallback(() => {
    dispatch(ConversationsActions.playbackPrevMessage());
  }, [dispatch]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isPlayback) {
        return;
      }
      if (
        isNextMessageInStack &&
        (e.key === 'Enter' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowRight' ||
          e.key == ' ')
      ) {
        e.preventDefault();
        handlePlaynextMessage();
      } else if (
        activeIndex &&
        activeIndex > 0 &&
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
      isNextMessageInStack,
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

  useEffect(() => {
    if (!controlsContainerRef) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      controlsContainerRef.current?.clientHeight &&
        onResize(controlsContainerRef.current.clientHeight);
    });
    controlsContainerRef.current &&
      resizeObserver.observe(controlsContainerRef.current);

    () => {
      resizeObserver.disconnect();
    };
  }, [controlsContainerRef, onResize]);

  return (
    <div
      ref={controlsContainerRef}
      className="absolute bottom-0 left-0 w-full border-transparent bg-gradient-to-b from-transparent via-gray-300 to-gray-300 pt-6 dark:via-gray-900 dark:to-gray-900 md:pt-2"
    >
      <div
        className="relative mx-2 mb-2 flex flex-row gap-3 md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:max-w-3xl"
        data-qa="playback-control"
      >
        <button
          data-qa="playback-prev"
          onClick={handlePrevMessage}
          disabled={activeIndex === 0}
          className="absolute bottom-3 left-4 rounded outline-none hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:dark:text-gray-600"
        >
          <IconPlayerPlay size={20} className="rotate-180" />
        </button>
        <div
          ref={nextMessageBoxRef}
          className="m-0 max-h-[150px] min-h-[44px] w-full overflow-y-auto whitespace-pre-wrap rounded border border-transparent bg-gray-100 px-12 py-3 text-left outline-none focus-visible:border-blue-500 dark:bg-gray-700"
          data-qa="playback-message"
        >
          {isMessageStreaming ? (
            <div
              className="absolute bottom-3 right-4 h-5 w-5 animate-spin rounded-full border-t-2 border-gray-500"
              data-qa="message-input-spinner"
            ></div>
          ) : (
            <>
              <span className="break-words" data-qa="playback-message-content">
                {activeMessageContent}
              </span>
              <button
                data-qa="playback-next"
                onClick={handlePlaynextMessage}
                className="absolute bottom-3 right-4 rounded outline-none hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:dark:text-gray-600"
                disabled={isMessageStreaming || !isNextMessageInStack}
              >
                <IconPlayerPlay size={20} className="shrink-0" />
              </button>
            </>
          )}
        </div>
        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-14 right-0 xl:right-2 2xl:bottom-0 2xl:right-[-60px] 2xl:top-auto"
            onScrollDownClick={onScrollDownClick}
          />
        )}
      </div>
      <div className="p-5 max-md:hidden">
        <FooterMessage />
      </div>
    </div>
  );
};
