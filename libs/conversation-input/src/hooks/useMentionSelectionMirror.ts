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
  /** Whether any mention is currently tracked; the mirror only exists then. */
  hasActiveMentions: boolean;
}

/** Return value of {@link useMentionSelectionMirror}. */
interface UseMentionSelectionMirrorResult {
  /** Ref to attach to the highlight-mirror `<div>`. */
  mirrorRef: RefObject<HTMLDivElement | null>;
  /** Mirror-relative rectangles to paint as the replacement selection highlight. */
  selectionRects: DOMRect[];
  /** Recomputes `selectionRects` from the textarea's current native selection. */
  updateSelectionRects: () => void;
}

/*
 * The native text selection has to be re-rendered by hand while a mention is
 * tracked: the textarea's own text is invisible (`textareaMentionMode`), so
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
  hasActiveMentions,
}: UseMentionSelectionMirrorParams): UseMentionSelectionMirrorResult => {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [selectionRects, setSelectionRects] = useState<DOMRect[]>([]);

  const updateSelectionRects = useCallback(() => {
    const textareaEl = textareaRef.current;
    const mirrorEl = mirrorRef.current;
    const selectionStart = textareaEl?.selectionStart;
    const selectionEnd = textareaEl?.selectionEnd;
    if (
      !hasActiveMentions ||
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

    const containerRect = mirrorEl.getBoundingClientRect();
    setSelectionRects(
      Array.from(range.getClientRects()).map(
        (rect) =>
          new DOMRect(
            rect.left - containerRect.left,
            rect.top - containerRect.top,
            rect.width,
            rect.height,
          ),
      ),
    );
  }, [hasActiveMentions, textareaRef]);

  useLayoutEffect(() => {
    updateSelectionRects();
  }, [updateSelectionRects, message]);

  useEffect(() => {
    if (!hasActiveMentions) return undefined;
    const textareaEl = textareaRef.current;
    if (textareaEl == null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(updateSelectionRects);
    observer.observe(textareaEl);
    return () => observer.disconnect();
  }, [hasActiveMentions, textareaRef, updateSelectionRects]);

  return { mirrorRef, selectionRects, updateSelectionRects };
};
