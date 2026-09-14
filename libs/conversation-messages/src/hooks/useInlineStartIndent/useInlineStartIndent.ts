import { useEffect, useRef, useState, type RefObject } from 'react';

/* Gap between the slot's inline-end edge and where the first text line starts. */
const SLOT_TEXT_GAP_PX = 4;

/**
 * Measures an inline-start slot overlaid on the text's first line and returns
 * its width as the `--cm-bubble-first-line-indent` CSS var value, so the first
 * text line starts past the slot and the text word-flows after it — the same
 * mechanism the conversation input uses for its `inlineStartSlot`.
 */
export const useInlineStartIndent = (
  hasSlot: boolean,
): {
  /** Ref for the slot's wrapper element — the measured element. */
  slotRef: RefObject<HTMLDivElement | null>;
  /** Value for `--cm-bubble-first-line-indent`; `undefined` while no slot renders. */
  firstLineIndent: string | undefined;
} => {
  const slotRef = useRef<HTMLDivElement>(null);
  const [slotWidth, setSlotWidth] = useState(0);

  useEffect(() => {
    if (!hasSlot) return;
    const slotElement = slotRef.current;
    if (slotElement == null) return;

    /*
     * Re-measured on resize, not only on mount: slot content can change
     * width after first render (e.g. a skill name resolved from the listing).
     */
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry != null) setSlotWidth(entry.contentRect.width);
    });
    observer.observe(slotElement);
    return () => observer.disconnect();
  }, [hasSlot]);

  const firstLineIndent = hasSlot
    ? `calc(${slotWidth}px + ${SLOT_TEXT_GAP_PX}px)`
    : undefined;

  return { slotRef, firstLineIndent };
};
