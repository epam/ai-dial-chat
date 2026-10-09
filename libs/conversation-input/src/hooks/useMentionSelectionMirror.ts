import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { buildMirrorSelectionRange } from '../utils/highlight-mirror';

/** Parameters for {@link useMentionSelectionMirror}. */
interface UseMentionSelectionMirrorParams {
  /** Ref to the real `<textarea>` whose native selection is being mirrored. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Current textarea value — a selection-rect recompute trigger. */
  message: string;
  /** Whether the highlight mirror is rendered (a mention or a synthetic insertion is present). */
  isMirrorActive: boolean;
}

/** Return value of {@link useMentionSelectionMirror}. */
interface UseMentionSelectionMirrorResult {
  /** Ref to attach to the highlight-mirror `<div>`. */
  mirrorRef: RefObject<HTMLDivElement | null>;
  /** Mirror-relative rectangles to paint as the replacement selection highlight. */
  selectionRects: DOMRect[];
  /** Recomputes `selectionRects` from the textarea's current native selection. */
  updateSelectionRects: () => void;
  /** Copies the textarea's vertical scroll offset and scrollbar gutter onto the mirror; wire it to the textarea's `onScroll`. */
  syncMirrorToTextarea: () => void;
}

/*
 * The native text selection has to be re-rendered by hand while the mirror is
 * active: the textarea's own text is invisible (`textareaMentionMode`), so
 * the browser's native `::selection` paints an opaque rectangle where
 * selected characters would be — with no visible glyph to paint over it,
 * that rectangle hides the mirror's own colored text/chips underneath
 * instead of tinting behind them (unlike a normal, visible-text textarea,
 * where native selection paints behind glyphs the browser itself owns).
 * `.textareaMentionMode::selection` (see `Input.module.scss`) turns that
 * native rectangle off, and this hook computes the replacement: one
 * translucent rect per `Range.getClientRects()` line (so a selection
 * spanning a wrap still renders as one rect per visual line, exactly like
 * the native behavior it replaces), positioned in the mirror — on top of its
 * text, since a translucent color stays legible either way, and nothing here
 * can guarantee paint order *behind* the mirror's own non-positioned text
 * nodes.
 */
export const useMentionSelectionMirror = ({
  textareaRef,
  message,
  isMirrorActive,
}: UseMentionSelectionMirrorParams): UseMentionSelectionMirrorResult => {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [selectionRects, setSelectionRects] = useState<DOMRect[]>([]);

  /*
   * The mirror is `overflow-hidden` and paints the only visible copy of the
   * text while active, so it has to follow the textarea's scroll offset by
   * hand. Otherwise a message taller than the box keeps showing its top
   * while the transparent textarea scrolls underneath
   * ([#9352](https://github.com/epam/ai-dial-chat/issues/9352)).
   *
   * It also has to wrap lines at the same points. Once the text outgrows the
   * box the textarea shows a vertical scrollbar that narrows its content
   * area, while the `overflow-hidden` mirror shows none — so a word at the
   * end of a line wraps in the textarea but not in the mirror, and the
   * mention/caret drift onto different lines
   * ([#9355](https://github.com/epam/ai-dial-chat/issues/9355)). A stable
   * gutter on the mirror reserves the same scrollbar width.
   */
  const syncMirrorToTextarea = useCallback(() => {
    const textareaEl = textareaRef.current;
    const mirrorEl = mirrorRef.current;
    if (textareaEl == null || mirrorEl == null) return;
    const hasScrollbar = textareaEl.offsetWidth > textareaEl.clientWidth;
    mirrorEl.style.scrollbarGutter = hasScrollbar ? 'stable' : '';
    mirrorEl.scrollTop = textareaEl.scrollTop;
  }, [textareaRef]);

  const updateSelectionRects = useCallback(() => {
    const textareaEl = textareaRef.current;
    const mirrorEl = mirrorRef.current;
    const selectionStart = textareaEl?.selectionStart;
    const selectionEnd = textareaEl?.selectionEnd;
    if (
      !isMirrorActive ||
      textareaEl == null ||
      mirrorEl == null ||
      selectionStart == null ||
      selectionEnd == null ||
      selectionStart === selectionEnd
    ) {
      setSelectionRects((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const range = buildMirrorSelectionRange(
      mirrorEl,
      selectionStart,
      selectionEnd,
    );
    if (range == null) {
      setSelectionRects((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    /*
     * Absolutely positioned children of a scrolled box sit in its content
     * coordinates, so the viewport diff is shifted by the mirror's scroll
     * offset to stay on the selected text once the message is scrolled.
     */
    const containerRect = mirrorEl.getBoundingClientRect();
    setSelectionRects(
      Array.from(range.getClientRects()).map(
        (rect) =>
          new DOMRect(
            rect.left - containerRect.left,
            rect.top - containerRect.top + mirrorEl.scrollTop,
            rect.width,
            rect.height,
          ),
      ),
    );
  }, [isMirrorActive, textareaRef]);

  /*
   * Also runs when the mirror mounts: it appears only once a mention is
   * inserted (e.g. after picking a skill in the browser), by which time the
   * textarea may already be scrolled away from the top.
   */
  useLayoutEffect(() => {
    if (isMirrorActive) syncMirrorToTextarea();
    updateSelectionRects();
  }, [isMirrorActive, syncMirrorToTextarea, updateSelectionRects, message]);

  useEffect(() => {
    if (!isMirrorActive) return undefined;
    const textareaEl = textareaRef.current;
    if (textareaEl == null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      syncMirrorToTextarea();
      updateSelectionRects();
    });
    observer.observe(textareaEl);
    return () => observer.disconnect();
  }, [isMirrorActive, textareaRef, syncMirrorToTextarea, updateSelectionRects]);

  return {
    mirrorRef,
    selectionRects,
    updateSelectionRects,
    syncMirrorToTextarea,
  };
};
