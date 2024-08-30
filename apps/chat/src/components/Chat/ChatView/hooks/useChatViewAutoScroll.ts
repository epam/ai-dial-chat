import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

import throttle from 'lodash/throttle';

const scrollThrottlingTimeout = 250;

export const useChatViewAutoScroll = (
  chatContainerRef: RefObject<HTMLDivElement>,
  chatMessagesRef: RefObject<HTMLDivElement>,
  mergedMessagesLength: number,
  messageIsStreaming: boolean,
) => {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const disableAutoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastScrollTop = useRef(0);

  const handleScrollToContainerHeight = useCallback(
    (behavior?: 'smooth') => {
      chatContainerRef.current?.scrollTo?.({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    },
    [chatContainerRef],
  );

  const setAutoScroll = useCallback(
    (scrollTo = false) => {
      clearTimeout(disableAutoScrollTimeoutRef.current);
      setAutoScrollEnabled(true);
      setShowScrollDownButton(false);

      if (scrollTo) {
        handleScrollToContainerHeight();
      }
    },
    [handleScrollToContainerHeight],
  );

  const scrollDown = useCallback(
    (force = false) => {
      if (autoScrollEnabled || force) {
        setAutoScroll(true);
      }
    },
    [autoScrollEnabled, setAutoScroll],
  );

  const throttledScrollDown = throttle(scrollDown, scrollThrottlingTimeout);

  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const bottomTolerance = 25;

      if (lastScrollTop.current > scrollTop) {
        setAutoScrollEnabled(false);
        setShowScrollDownButton(true);
      } else if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
        clearTimeout(disableAutoScrollTimeoutRef.current);

        disableAutoScrollTimeoutRef.current = setTimeout(() => {
          setAutoScrollEnabled(false);
          setShowScrollDownButton(true);
        }, scrollThrottlingTimeout);
      } else {
        setAutoScroll();
      }

      lastScrollTop.current = scrollTop;
    }
  }, [chatContainerRef, setAutoScroll]);

  useEffect(() => {
    scrollDown();
  }, [scrollDown]);

  useEffect(() => {
    throttledScrollDown();
  }, [mergedMessagesLength, throttledScrollDown]);

  const observeResize = useCallback(
    (ref: RefObject<HTMLDivElement>) => {
      const handleResize = () => {
        if (ref.current && !messageIsStreaming && mergedMessagesLength) {
          handleScroll();
        }
      };

      const resizeObserver = new ResizeObserver(handleResize);

      if (ref.current) {
        resizeObserver.observe(ref.current);
      }

      return () => {
        resizeObserver.disconnect();
      };
    },
    [handleScroll, mergedMessagesLength, messageIsStreaming],
  );

  useEffect(
    () => observeResize(chatContainerRef),
    [observeResize, chatContainerRef],
  );

  useEffect(
    () => observeResize(chatMessagesRef),
    [observeResize, chatMessagesRef],
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo?.({
        top: chatContainerRef.current.scrollHeight,
      });
    }
  }, [chatContainerRef]);

  return {
    handleScroll,
    handleScrollDown: () => scrollDown(true),
    handleScrollToContainerHeight,
    showScrollDownButton,
    setShowScrollDownButton,
    setAutoScroll,
  };
};
