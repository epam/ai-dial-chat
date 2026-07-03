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
 * Owns all scroll behaviour for the conversation message list:
 * - Anchors a freshly sent/regenerated/edited message near the top of the
 *   viewport, leaving room below it for the streamed response. A spacer
 *   reserves scroll room so the anchor is reachable even when little content
 *   currently follows it, then shrinks as the response streams in.
 * - Never force-scrolls while a response is streaming — the view stays
 *   wherever the user (or the last anchor) left it.
 * - Drives the scroll-to-bottom button's visibility from both manual
 *   scrolling and content growth.
 *
 * See openspec/changes/chat-scroll-ux for the full design rationale,
 * including why the spacer must be recomputed in a `useLayoutEffect` (not a
 * `ResizeObserver` or CSS `min-height`/`flex-grow`) and why it needs
 * `shrink-0`.
 */
export const useConversationScroll = ({
  messages,
  isAssistantTyping,
}: Params): Result => {
  const [isScrollButtonVisible, setIsScrollButtonVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  // DOM nodes of rendered messages, keyed by index — used to anchor a
  // specific message near the top of the viewport on send/regenerate/edit.
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

  // Index of the message to anchor near the top on the next messages-effect
  // run. Set via `armAnchor`, consumed once by that effect.
  const pendingAnchorIndexRef = useRef<number | null>(null);
  const armAnchor = useCallback((index: number) => {
    pendingAnchorIndexRef.current = index;
  }, []);

  // Total height (real content + reserved room) frozen at anchor time.
  // 0 means "no active reservation" — the spacer stays at 0 in that state.
  const requiredTotalRef = useRef(0);

  const performScroll = useCallback((targetTop: number, instant: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      top: targetTop,
      behavior: instant ? 'instant' : 'smooth',
    });
  }, []);

  // Absolute scroll offset (relative to scrollTop 0) at which `contentRef`'s
  // bottom edge — the end of the real message content, excluding the
  // spacer — sits flush with the bottom of the visible viewport.
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

  // Scrolls so the message at `index` lands near the top of the viewport,
  // leaving room below it for a streamed response to render into. Uses
  // getBoundingClientRect (not offsetTop) since offsetTop resolves against
  // the nearest positioned ancestor, which is unreliable here — message
  // bubbles commonly use position: relative for their action buttons.
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

  // Distance from the current viewport's bottom edge to the actual end of
  // message content (excluding the spacer) — used for the scroll-to-bottom
  // button so it doesn't stay visible just because reserved space hasn't
  // been scrolled into.
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

  // On send/regenerate/edit: freeze the total room needed (content height
  // right now + viewport height), size the spacer to match, then scroll the
  // armed message to the top, once. While a reservation is active, each
  // later run recomputes the spacer from the frozen total minus the
  // content's current real height. Otherwise, only scroll on non-streaming
  // message-count changes (conversation load, message deletion) — never
  // while a response is streaming.
  const prevLengthRef = useRef(messages.length);
  useLayoutEffect(() => {
    const lengthChanged = messages.length !== prevLengthRef.current;
    prevLengthRef.current = messages.length;

    const container = containerRef.current;
    const content = contentRef.current;
    const spacer = spacerRef.current;

    const anchorIndex = pendingAnchorIndexRef.current;
    if (anchorIndex != null && messageRefsMap.current.has(anchorIndex)) {
      pendingAnchorIndexRef.current = null;
      if (container && content && spacer) {
        const currentContentHeight = content.getBoundingClientRect().height;
        requiredTotalRef.current =
          currentContentHeight + container.clientHeight;
        spacer.style.height = `${container.clientHeight}px`;
      }
      scrollMessageToTop(anchorIndex, false);
      return;
    }

    if (requiredTotalRef.current > 0 && content && spacer) {
      const currentContentHeight = content.getBoundingClientRect().height;
      const needed = Math.max(
        requiredTotalRef.current - currentContentHeight,
        0,
      );
      spacer.style.height = `${needed}px`;
    }

    if (!isAssistantTyping && lengthChanged) {
      scrollToBottom(false);
    }
  }, [messages, isAssistantTyping, scrollToBottom, scrollMessageToTop]);

  // Once the turn completes, drop any leftover reserved space immediately —
  // don't wait for content growth to fully consume it (e.g. a short
  // response never grows past the frozen total on its own).
  useLayoutEffect(() => {
    if (!isAssistantTyping) {
      requiredTotalRef.current = 0;
      if (spacerRef.current) {
        spacerRef.current.style.height = '0px';
      }
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

  // Streamed content grows the content box without moving scrollTop (we
  // never auto-follow), so no native 'scroll' event fires on its own —
  // observe the content box directly so the button still reflects unseen
  // content as a response streams past the fold.
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
