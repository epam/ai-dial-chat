import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMentionSelectionMirror } from '../../../hooks/useMentionSelectionMirror';
import type { InputProps } from '../../../models/Input';
import type { MirrorInsertion } from '../../../utils/highlight-mirror';
import styles from '../Input.module.scss';

interface UseCommandMenuAnchorParams {
  commandMenu: InputProps['commandMenu'];
  message: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  hasActiveMentions: boolean;
  /* From `useCommandMenuController`: the trigger word's offset while the menu is open. */
  markerOffset: number | null;
  triggerEnd: number | null;
  hasCommandEmptyQueryHint: boolean;
}

/**
 * Anchors `Input`'s command popup to the trigger word: splices a zero-size
 * caret marker (and the empty-query hint) into the mention-highlight mirror,
 * keeps the mirror in sync with the textarea, and measures the marker's
 * position relative to the textarea area. `useMentionSelectionMirror` is
 * called before the measuring layout effect on purpose, so the mirror has
 * scrolled into sync before the marker inside it is measured. Private to
 * `Input`.
 */
export const useCommandMenuAnchor = ({
  commandMenu,
  message,
  textareaRef,
  hasActiveMentions,
  markerOffset,
  triggerEnd,
  hasCommandEmptyQueryHint,
}: UseCommandMenuAnchorParams) => {
  /*
   * `left`/`top` (physical, not logical) is intentional here: the value is
   * a real measured pixel position read off the marker's rendered box,
   * which already reflects the browser's own RTL glyph placement — the
   * same measured-value exception `left-1/2 -translate-x-1/2` centering
   * gets in `.claude/rules/rtl.md`, not a static directional utility that
   * would need an `rtl:`/logical counterpart.
   */
  const caretMarkerRef = useRef<HTMLSpanElement | null>(null);
  const textareaAreaRef = useRef<HTMLDivElement | null>(null);
  const [caretAnchor, setCaretAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);

  /*
   * `getBoundingClientRect()` diff against `textareaAreaRef`, not
   * `offsetLeft`/`offsetTop` — see `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3b
   * (multi-skill-message-mentions).
   */
  const measureCaretAnchor = useCallback(() => {
    const marker = caretMarkerRef.current;
    const container = textareaAreaRef.current;
    if (marker == null || container == null) {
      setCaretAnchor(null);
      return;
    }
    const markerRect = marker.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setCaretAnchor({
      left: markerRect.left - containerRect.left,
      top: markerRect.top - containerRect.top,
    });
  }, []);

  /*
   * Auto-resizing the textarea's own width (e.g. a container resize) can
   * reflow where the marker's line wraps without changing `message` or
   * `markerOffset` — re-measure whenever the textarea's box changes while
   * an overlay actually needs the position.
   */
  useEffect(() => {
    if (markerOffset == null) return undefined;
    const textareaEl = textareaRef.current;
    if (textareaEl == null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measureCaretAnchor);
    observer.observe(textareaEl);
    return () => observer.disconnect();
  }, [markerOffset, textareaRef, measureCaretAnchor]);

  const mirrorInsertions = useMemo(() => {
    const list: MirrorInsertion[] = [];
    if (markerOffset != null) {
      list.push({
        offset: markerOffset,
        node: (
          <span
            key="caret-marker"
            ref={caretMarkerRef}
            aria-hidden
            className="inline-block h-lh w-0 align-text-top"
          />
        ),
      });
    }
    if (hasCommandEmptyQueryHint && commandMenu != null && triggerEnd != null) {
      list.push({
        offset: triggerEnd,
        node: (
          <span
            key="command-hint"
            className={styles.commandHint}
            aria-hidden
            data-mirror-synthetic
          >
            {commandMenu.emptyQueryHint}
          </span>
        ),
      });
    }
    return list;
  }, [markerOffset, hasCommandEmptyQueryHint, commandMenu, triggerEnd]);

  /*
   * The mirror also renders while only synthetic insertions exist (the
   * caret marker / empty-query hint of an open `/query`), and the
   * textarea's native selection is hidden whenever it does — so the
   * replacement selection highlight must follow the same condition, not
   * just `hasActiveMentions` ([#9231](https://github.com/epam/ai-dial-chat/issues/9231)).
   */
  const isMirrorActive = hasActiveMentions || mirrorInsertions.length > 0;

  const {
    mirrorRef,
    selectionRects,
    updateSelectionRects,
    syncMirrorToTextarea,
  } = useMentionSelectionMirror({ textareaRef, message, isMirrorActive });

  /*
   * Declared after `useMentionSelectionMirror` so its layout effect has
   * already scrolled the mirror into sync: the caret marker lives inside
   * the mirror, and measuring it first would anchor the command menu to
   * the unscrolled position.
   */
  useLayoutEffect(() => {
    measureCaretAnchor();
  }, [measureCaretAnchor, markerOffset, message]);

  const handleTextareaScroll = () => {
    syncMirrorToTextarea();
    if (markerOffset != null) measureCaretAnchor();
  };

  return {
    textareaAreaRef,
    caretAnchor,
    mirrorInsertions,
    isMirrorActive,
    mirrorRef,
    selectionRects,
    updateSelectionRects,
    handleTextareaScroll,
  };
};
