import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
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

import { ScrollDownButton } from './ScrollDownButton';

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

  const activeMessage = useAppSelector(
    ConversationsSelectors.selectPlaybackActiveMessage,
  );

  const controlsContainerRef = useRef<HTMLDivElement | null>(null);

  const isActiveIndex = typeof activeIndex === 'number';

  const isNextMessageInStack = useMemo(() => {
    return (
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

  const handleCancelPlaybackMode = useCallback(() => {
    dispatch(ConversationsActions.playbackCancel());
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

  useEffect(() => {
    if (nextMessageBoxRef && nextMessageBoxRef.current) {
      nextMessageBoxRef.current.style.height = 'inherit';
      nextMessageBoxRef.current.style.height = `${nextMessageBoxRef.current?.scrollHeight}px`;
      nextMessageBoxRef.current.style.overflow = `${
        nextMessageBoxRef?.current?.scrollHeight > 400 ? 'auto' : 'hidden'
      }`;
    }
  }, [activeMessage, nextMessageBoxRef]);

  return (
    <div
      ref={controlsContainerRef}
      className="absolute bottom-0 left-0 flex w-full items-end gap-1 border-transparent bg-gradient-to-b from-transparent via-gray-300 to-gray-300 p-3 dark:via-gray-900 dark:to-gray-900 md:p-6 md:pt-2 xl:px-14"
    >
      <button
        onClick={handleCancelPlaybackMode}
        className="flex shrink-0 items-center rounded border border-gray-400 bg-gray-200 p-2 hover:bg-gray-400 disabled:cursor-not-allowed disabled:bg-gray-500 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600 disabled:dark:bg-gray-500"
      >
        <IconPlayerStop size={20} className="shrink-0" />
      </button>

      {isActiveIndex && activeIndex > 0 && (
        <button
          onClick={handlePrevMessage}
          className="flex shrink-0 items-center rounded border border-gray-400 bg-gray-200 p-2 hover:bg-gray-400 disabled:cursor-not-allowed disabled:bg-gray-500 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600 disabled:dark:bg-gray-500"
        >
          <IconPlayerPlay size={20} className="rotate-180" />
        </button>
      )}
      {isNextMessageInStack && (
        <>
          <div
            ref={nextMessageBoxRef}
            className="max-h-[150px] w-full overflow-y-auto whitespace-pre-wrap rounded border border-transparent bg-gray-100 px-3 py-2 text-left focus-visible:border-blue-500 focus-visible:outline-none dark:bg-gray-700"
          >
            {isMessageStreaming ? (
              <div
                className="h-5 w-5 animate-spin rounded-full border-t-2 border-gray-500"
                data-qa="message-input-spinner"
              ></div>
            ) : (
              <span>{activeMessageContent}</span>
            )}
          </div>
          <button
            onClick={handlePlaynextMessage}
            className="flex shrink-0 items-center rounded border border-gray-400 bg-gray-200 p-2 hover:bg-gray-400 disabled:cursor-not-allowed disabled:bg-gray-500 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600 disabled:dark:bg-gray-500"
            disabled={isMessageStreaming}
          >
            <IconPlayerPlay size={20} className="shrink-0" />
          </button>
        </>
      )}

      {showScrollDownButton && (
        <ScrollDownButton
          containerClassNames="bottom-16 right-2 md:right-5 md:bottom-20 xl:right-2 xl:bottom-6"
          onScrollDownClick={onScrollDownClick}
        />
      )}
    </div>
  );
};
