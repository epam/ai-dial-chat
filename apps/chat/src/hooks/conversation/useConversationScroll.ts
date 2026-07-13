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
 * The temporary spacer stays fixed during a turn. Shrinking it while rendered
 * markdown is still growing can reduce total scroll height and make the
 * browser clamp `scrollTop`, which is visible as a jump.
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

  /*
   * Uses rects instead of `offsetTop` because message internals can introduce
   * positioned ancestors for action controls.
   */
  const scrollMessageToTop = useCallback(
    (index: number, instant = false) => {
      const container = containerRef.current;
      const el = messageRefsMap.current.get(index);
      if (!container || !el) return;

      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetTop = container.scrollTop + (elRect.top - containerRect.top);
      performScroll(Math.max(targetTop, 0), instant);
    },
    [performScroll],
  );

  /*
   * Measures distance to real content bottom so spacer space alone does not
   * keep the scroll-to-bottom button visible.
   */
  const updateScrollButtonVisibility = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const containerRect = container.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const distanceFromContentBottom =
      contentRect.bottom - containerRect.top - container.clientHeight;
    setIsScrollButtonVisible(
      distanceFromContentBottom >= NEAR_BOTTOM_THRESHOLD,
    );
  }, []);

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

    const container = containerRef.current;
    const spacer = spacerRef.current;

    const anchorIndex = pendingAnchorIndexRef.current;
    if (anchorIndex != null && messageRefsMap.current.has(anchorIndex)) {
      pendingAnchorIndexRef.current = null;
      if (container && spacer) {
        spacer.style.height = `${container.clientHeight}px`;
      }
      scrollMessageToTop(anchorIndex, false);
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
    scrollMessageToTop,
  ]);

  /*
   * MarkdownRenderer flushes buffered typewriter content synchronously when
   * streaming stops, so clearing the spacer cannot race a growing reply.
   */
  useLayoutEffect(() => {
    if (!isAssistantTyping && spacerRef.current) {
      spacerRef.current.style.height = '0px';
    }
  }, [isAssistantTyping]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', updateScrollButtonVisibility, {
      passive: true,
    });
    return () =>
      container.removeEventListener('scroll', updateScrollButtonVisibility);
  }, [updateScrollButtonVisibility]);

  /*
   * Streaming grows content without firing a native scroll event. Observe
   * content size so the button reflects newly hidden content below the fold.
   */
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => updateScrollButtonVisibility());
    observer.observe(content);
    return () => observer.disconnect();
  }, [updateScrollButtonVisibility]);

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
