import { IconPlayerPlay } from '@tabler/icons-react';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

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

enum PlaybackPhases {
  EMPTY = 'EMPTY',
  MESSAGE = 'MESSAGE',
}

export const PlaybackControls = ({
  onScrollDownClick,
  onResize,
  nextMessageBoxRef,
  showScrollDownButton,
}: Props) => {
  const { t } = useTranslation('playback');
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
  const [phase, setPhase] = useState<PlaybackPhases>(PlaybackPhases.EMPTY);

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

  const isPrevMessageInStack = useMemo(() => {
    const prevIndex = isMessageStreaming ? 1 : 2;
    return (
      selectedConversations.length &&
      !!selectedConversations[0].playback &&
      isActiveIndex &&
      activeIndex >= 0 &&
      selectedConversations[0].playback.messagesStack.length &&
      selectedConversations[0].playback.messagesStack[activeIndex - prevIndex]
    );
  }, [activeIndex, isActiveIndex, selectedConversations, isMessageStreaming]);

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

  const handlePlayNextMessage = useCallback(() => {
    if (isMessageStreaming || !isNextMessageInStack) {
      return;
    }
    if (phase === PlaybackPhases.EMPTY) {
      setPhase(PlaybackPhases.MESSAGE);
      return;
    }
    setPhase(PlaybackPhases.EMPTY);

    dispatch(ConversationsActions.playbackNextMessageStart());
  }, [dispatch, isMessageStreaming, isNextMessageInStack, phase]);

  const handlePrevMessage = useCallback(() => {
    if (activeIndex === 0 && phase !== PlaybackPhases.MESSAGE) {
      return;
    }
    if (phase === PlaybackPhases.EMPTY) {
      setPhase(PlaybackPhases.MESSAGE);
    } else {
      setPhase(PlaybackPhases.EMPTY);
      if (isPrevMessageInStack) {
        return;
      }
    }
    if (!isPrevMessageInStack) {
      return;
    }

    dispatch(ConversationsActions.playbackPrevMessage());
  }, [dispatch, isPrevMessageInStack, phase, activeIndex]);

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
        handlePlayNextMessage();
      } else if (
        isActiveIndex &&
        activeIndex >= 0 &&
        (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
      ) {
        e.preventDefault();
        handlePrevMessage();
      }
    },
    [
      isActiveIndex,
      activeIndex,
      handlePlayNextMessage,
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

    return () => {
      resizeObserver.disconnect();
    };
  }, [controlsContainerRef, onResize]);

  return (
    <div ref={controlsContainerRef} className="w-full pt-3 md:pt-5">
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
          disabled={activeIndex === 0 && phase !== PlaybackPhases.MESSAGE}
          className="absolute bottom-3 left-4 rounded text-quaternary-bg-light outline-none hover:text-primary-bg-light disabled:cursor-not-allowed disabled:text-controls-disable"
        >
          <IconPlayerPlay size={20} className="rotate-180" />
        </button>
        <div
          ref={nextMessageBoxRef}
          className="m-0 max-h-[150px] min-h-[46px] w-full overflow-y-auto whitespace-pre-wrap rounded-full border border-secondary bg-layer-2 px-12 py-3 text-left shadow-primary outline-none placeholder:text-xs placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary"
          data-qa="playback-message"
        >
          {isMessageStreaming ? (
            <div
              className="absolute bottom-3 right-4 size-5 animate-spin rounded-full border-t-2 border-primary"
              data-qa="message-input-spinner"
            ></div>
          ) : (
            <>
              {activeMessage && (
                <>
                  <span
                    className={classNames(
                      'break-words',
                      phase === PlaybackPhases.EMPTY &&
                        'text-quaternary-bg-light',
                    )}
                    data-qa="playback-message-content"
                  >
                    {phase === PlaybackPhases.EMPTY
                      ? t('chat.playback.type_message.text')
                      : activeMessage.content ?? ''}
                  </span>

                  {phase === PlaybackPhases.MESSAGE && hasAttachments && (
                    <PlaybackAttachments
                      attachments={activeMessage.custom_content.attachments}
                    />
                  )}
                  <button
                    data-qa="playback-next"
                    onClick={handlePlayNextMessage}
                    className="absolute bottom-3 right-4 rounded text-quaternary-bg-light outline-none hover:text-primary-bg-light disabled:cursor-not-allowed disabled:text-controls-disable"
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
            className="-top-16 right-0 md:-right-14 md:top-[50%] md:-translate-y-1/2"
            onScrollDownClick={onScrollDownClick}
          />
        )}
      </div>
      <ChatInputFooter />
    </div>
  );
};
