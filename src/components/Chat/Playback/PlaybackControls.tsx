import { IconPlayerPlay } from '@tabler/icons-react';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import classNames from 'classnames';

import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

import { ChatInputFooter } from '../ChatInput/ChatInputFooter';
import { PlaybackAttachments } from './PlaybackAttachments';

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

  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

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

  const activeMessage = useMemo(() => {
    if (!isActiveIndex) {
      return;
    }
    const currentPlayback = selectedConversations[0]?.playback;
    const currentMessage = currentPlayback?.messagesStack[activeIndex];

    const content =
      isNextMessageInStack && currentMessage && currentMessage?.content;

    const attachments =
      currentMessage && currentMessage?.custom_content?.attachments?.length
        ? currentMessage.custom_content.attachments
        : [];
    const message = attachments.length
      ? { content, custom_content: { attachments } }
      : { content };
    return message;
  }, [activeIndex, isActiveIndex, isNextMessageInStack, selectedConversations]);

  const hasAttachments =
    activeMessage &&
    activeMessage.custom_content &&
    activeMessage.custom_content.attachments &&
    activeMessage.custom_content.attachments.length;

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
      if (!isPlayback || hasParentWithFloatingOverlay(e.target as Element)) {
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
      className="gradient-top-bottom gradient-absolute-bottom"
    >
      <div
        className={classNames(
          'relative mx-2 mb-2 flex flex-row gap-3 md:mx-4 md:mb-0 md:last:mb-6',
          isChatFullWidth ? 'lg:ml-20 lg:mr-[84px]' : 'lg:mx-auto lg:max-w-3xl',
        )}
        data-qa="playback-control"
      >
        <button
          data-qa="playback-prev"
          onClick={handlePrevMessage}
          disabled={activeIndex === 0}
          className="absolute bottom-3 left-4 rounded outline-none hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
        >
          <IconPlayerPlay size={20} className="rotate-180" />
        </button>
        <div
          ref={nextMessageBoxRef}
          className="m-0 max-h-[150px] min-h-[44px] w-full overflow-y-auto whitespace-pre-wrap rounded border border-transparent bg-layer-3 px-12 py-3 text-left outline-none focus-visible:border-accent-primary"
          data-qa="playback-message"
        >
          {isMessageStreaming ? (
            <div
              className="absolute bottom-3 right-4 h-5 w-5 animate-spin rounded-full border-t-2 border-primary"
              data-qa="message-input-spinner"
            ></div>
          ) : (
            <>
              {activeMessage && (
                <>
                  <span
                    className="break-words"
                    data-qa="playback-message-content"
                  >
                    {activeMessage.content ?? ''}
                  </span>

                  {hasAttachments && (
                    <PlaybackAttachments
                      attachments={activeMessage.custom_content.attachments}
                    />
                  )}
                  <button
                    data-qa="playback-next"
                    onClick={handlePlaynextMessage}
                    className="absolute bottom-3 right-4 rounded outline-none hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                    disabled={isMessageStreaming || !isNextMessageInStack}
                  >
                    <IconPlayerPlay size={20} className="shrink-0" />
                  </button>
                </>
              )}
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
      <ChatInputFooter />
    </div>
  );
};
