import type { Message as MessageType } from '@epam/ai-dial-chat-shared';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

const NEAR_BOTTOM_THRESHOLD = 80;
const SPACER_CLEAR_TOLERANCE = 1;
const SCROLL_CLAMP_TOLERANCE = 1;

interface Params {
  messages: MessageType[];
  isAssistantTyping: boolean;
  conversationId: string;
}

interface Result {
  /** Attach to the scrollable message-list element. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Attach to the element wrapping all rendered messages (used to detect content growth). */
  contentRef: RefObject<HTMLDivElement | null>;
  /**
   * Attach to a spacer element, a sibling rendered right after `contentRef`
   * inside `containerRef`. Its height is set imperatively, not via React
   * state. Render it with `shrink-0` and an initial `style={{ height: 0 }}`.
   */
  spacerRef: RefObject<HTMLDivElement | null>;
  /** Callback ref to register/unregister a rendered message's DOM node by index. */
  setMessageRef: (index: number, el: HTMLDivElement | null) => void;
  /** Whether the scroll-to-bottom button should be shown. */
  isScrollButtonVisible: boolean;
  /** Smoothly scrolls to the current bottom of the actual message content. */
  scrollToBottom: () => void;
  /**
   * Arms the message at `index` to be scrolled near the top of the viewport
   * on the next render — call right before triggering a send, regenerate,
   * or edit-and-resubmit so the resulting message anchors near the top.
   */
  armAnchor: (index: number) => void;
}

/**
 * Owns chat-list scrolling: anchors a new turn near the viewport top, keeps
 * the position stable while the response streams, and reports whether the
 * scroll-to-bottom button should be shown.
 *
 * The temporary spacer is technical scroll room, not user-visible content:
 * it is sized to the minimum required to make the anchor reachable and manual
 * scrolling is clamped before the user can move past the real message content.
 */
export const useConversationScroll = ({
  messages,
  isAssistantTyping,
  conversationId,
}: Params): Result => {
  const [isScrollButtonVisible, setIsScrollButtonVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const isSpacerActiveRef = useRef(false);
  const isSpacerSettledRef = useRef(false);
  const anchorScrollTopRef = useRef<number | null>(null);

  /*
   * Message DOM nodes keyed by index, used to anchor the acted-on message
   * without coupling this hook to send/regenerate/edit handlers.
   */
  const messageRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const setMessageRef = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      if (el) {
        messageRefsMap.current.set(index, el);
      } else {
        messageRefsMap.current.delete(index);
      }
    },
    [],
  );

  /*
   * Message index to anchor after the next render. It is set by `armAnchor`
   * and consumed once by the layout effect below.
   */
  const pendingAnchorIndexRef = useRef<number | null>(null);
  const armAnchor = useCallback((index: number) => {
    pendingAnchorIndexRef.current = index;
  }, []);

  const performScroll = useCallback((targetTop: number, instant: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      top: targetTop,
      behavior: instant ? 'instant' : 'smooth',
    });
  }, []);

  const clearSpacer = useCallback(() => {
    if (spacerRef.current) {
      spacerRef.current.style.height = '0px';
    }
    isSpacerActiveRef.current = false;
    isSpacerSettledRef.current = false;
    anchorScrollTopRef.current = null;
  }, []);

  /*
   * ScrollTop where the real content bottom, excluding spacer space, aligns
   * with the viewport bottom.
   */
  const getContentBottomScrollTop = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return null;
    const containerRect = container.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    return (
      container.scrollTop +
      (contentRect.bottom - containerRect.top) -
      container.clientHeight
    );
  }, []);

  const scrollToBottom = useCallback(
    (instant = false) => {
      const target = getContentBottomScrollTop();
      if (target == null) return;
      performScroll(Math.max(target, 0), instant);
    },
    [performScroll, getContentBottomScrollTop],
  );

  const getDistanceFromContentBottom = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return null;
    const containerRect = container.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    return contentRect.bottom - containerRect.top - container.clientHeight;
  }, []);

  const clearSettledSpacerIfPossible = useCallback(() => {
    if (!isSpacerSettledRef.current) return;

    const distanceFromContentBottom = getDistanceFromContentBottom();
    if (
      distanceFromContentBottom == null ||
      distanceFromContentBottom < -SPACER_CLEAR_TOLERANCE
    ) {
      return;
    }

    clearSpacer();
  }, [clearSpacer, getDistanceFromContentBottom]);

  /*
   * Uses rects instead of `offsetTop` because message internals can introduce
   * positioned ancestors for action controls.
   */
  const getMessageTopScrollTarget = useCallback((index: number) => {
    const container = containerRef.current;
    const el = messageRefsMap.current.get(index);
    if (!container || !el) return null;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = container.scrollTop + (elRect.top - containerRect.top);
    return Math.max(targetTop, 0);
  }, []);

  const scrollMessageToTop = useCallback(
    (index: number, instant = false) => {
      const targetTop = getMessageTopScrollTarget(index);
      if (targetTop == null) return;

      performScroll(targetTop, instant);
    },
    [getMessageTopScrollTarget, performScroll],
  );

  const getMaxScrollTopExcludingSpacer = useCallback(() => {
    const target = getContentBottomScrollTop();
    return target == null ? null : Math.max(target, 0);
  }, [getContentBottomScrollTop]);

  const getMaxAllowedScrollTop = useCallback(() => {
    if (!isSpacerActiveRef.current) return null;

    const anchorScrollTop = anchorScrollTopRef.current;
    const contentBottomScrollTop = getMaxScrollTopExcludingSpacer();
    if (anchorScrollTop == null || contentBottomScrollTop == null) return null;

    return Math.max(anchorScrollTop, contentBottomScrollTop);
  }, [getMaxScrollTopExcludingSpacer]);

  const clampScrollToVisibleContent = useCallback(() => {
    const container = containerRef.current;
    const maxAllowedScrollTop = getMaxAllowedScrollTop();
    if (!container || maxAllowedScrollTop == null) return;

    if (container.scrollTop > maxAllowedScrollTop + SCROLL_CLAMP_TOLERANCE) {
      container.scrollTop = maxAllowedScrollTop;
    }
  }, [getMaxAllowedScrollTop]);

  const applyAnchorSpacer = useCallback(
    (targetTop: number) => {
      const spacer = spacerRef.current;
      const maxScrollTopExcludingSpacer = getMaxScrollTopExcludingSpacer();
      if (!spacer || maxScrollTopExcludingSpacer == null) return;

      const spacerHeight = Math.max(targetTop - maxScrollTopExcludingSpacer, 0);
      spacer.style.height = `${spacerHeight}px`;
      isSpacerActiveRef.current = spacerHeight > 0;
      isSpacerSettledRef.current = false;
      anchorScrollTopRef.current = spacerHeight > 0 ? targetTop : null;
    },
    [getMaxScrollTopExcludingSpacer],
  );

  const scrollMessageToTopWithReservation = useCallback(
    (index: number) => {
      const targetTop = getMessageTopScrollTarget(index);
      if (targetTop == null) return;

      applyAnchorSpacer(targetTop);
      scrollMessageToTop(index, false);
    },
    [applyAnchorSpacer, getMessageTopScrollTarget, scrollMessageToTop],
  );

  /*
   * Measures distance to real content bottom so spacer space alone does not
   * keep the scroll-to-bottom button visible.
   */
  const updateScrollButtonVisibility = useCallback(() => {
    const distanceFromContentBottom = getDistanceFromContentBottom();
    if (distanceFromContentBottom == null) return;
    setIsScrollButtonVisible(
      distanceFromContentBottom >= NEAR_BOTTOM_THRESHOLD,
    );
  }, [getDistanceFromContentBottom]);

  /*
   * Anchor an armed turn once. Other non-streaming length changes, such as
   * loading a conversation or deleting a message, keep the old bottom-scroll
   * behavior.
   */
  const prevLengthRef = useRef(messages.length);
  const prevConversationIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const lengthChanged = messages.length !== prevLengthRef.current;
    const conversationChanged =
      conversationId !== prevConversationIdRef.current;

    const commitObservedScrollState = () => {
      prevLengthRef.current = messages.length;
      prevConversationIdRef.current = conversationId;
    };

    if (conversationChanged) {
      clearSpacer();
    }

    const anchorIndex = pendingAnchorIndexRef.current;
    if (anchorIndex != null && messageRefsMap.current.has(anchorIndex)) {
      pendingAnchorIndexRef.current = null;
      scrollMessageToTopWithReservation(anchorIndex);
      commitObservedScrollState();
      return;
    }

    if (isAssistantTyping) return;

    if (lengthChanged || conversationChanged) {
      scrollToBottom(false);
    }

    commitObservedScrollState();
  }, [
    messages,
    isAssistantTyping,
    conversationId,
    scrollToBottom,
    scrollMessageToTopWithReservation,
    clearSpacer,
  ]);

  /*
   * Keep a completed short reply anchored with its reserved room until the
   * user scrolls far enough up that removing the spacer cannot clamp scrollTop.
   */
  useLayoutEffect(() => {
    if (!isAssistantTyping && isSpacerActiveRef.current) {
      isSpacerSettledRef.current = true;
      clearSettledSpacerIfPossible();
    }
  }, [isAssistantTyping, clearSettledSpacerIfPossible]);

  const handleScroll = useCallback(() => {
    clampScrollToVisibleContent();
    clearSettledSpacerIfPossible();
    updateScrollButtonVisibility();
  }, [
    clampScrollToVisibleContent,
    clearSettledSpacerIfPossible,
    updateScrollButtonVisibility,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, {
      passive: true,
    });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  /*
   * Streaming grows content without firing a native scroll event. Observe
   * content size so the button reflects newly hidden content below the fold.
   */
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      clampScrollToVisibleContent();
      clearSettledSpacerIfPossible();
      updateScrollButtonVisibility();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [
    clampScrollToVisibleContent,
    clearSettledSpacerIfPossible,
    updateScrollButtonVisibility,
  ]);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  return {
    containerRef,
    contentRef,
    spacerRef,
    setMessageRef,
    isScrollButtonVisible,
    scrollToBottom: handleScrollToBottom,
    armAnchor,
  };
};
