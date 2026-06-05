import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_LINE_HEIGHT_FALLBACK = 24;
const OVERFLOW_TOLERANCE = 1;

export interface UseCollapsedTextOptions {
  /** Content identity used to reset long text to the collapsed state when it changes. */
  text: string;
  /** Maximum number of text lines shown while collapsed. */
  collapsedLineCount: number;
}

export interface UseCollapsedTextResult {
  /** Ref attached to the text element whose rendered height should be measured. */
  textRef: RefObject<HTMLParagraphElement | null>;
  /** Whether the full text is currently hidden behind the collapsed viewport. */
  isTextCollapsed: boolean;
  /** Whether the measured text is taller than the collapsed viewport. */
  isOverflowing: boolean;
  /** Current collapsed viewport height in pixels. */
  collapsedMaxHeight: number;
  /** Whether the expanded/collapsed control is currently in the collapsed state. */
  isCollapsed: boolean;
  /** Toggle between expanded and collapsed states. */
  toggleCollapsed: () => void;
}

/** Measures rendered text and owns the expand/collapse state for long plain-text content. */
export const useCollapsedText = ({
  text,
  collapsedLineCount,
}: UseCollapsedTextOptions): UseCollapsedTextResult => {
  const effectiveCollapsedLineCount = Math.max(1, collapsedLineCount);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(
    DEFAULT_LINE_HEIGHT_FALLBACK * effectiveCollapsedLineCount,
  );

  const measureOverflow = useCallback(() => {
    const el = textRef.current;
    if (!el) return;

    const computedStyle = window.getComputedStyle(el);
    const parsedFontSize = Number.parseFloat(computedStyle.fontSize);
    const fontSize = Number.isNaN(parsedFontSize) ? 16 : parsedFontSize;
    const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
    const lineHeight = (() => {
      if (
        computedStyle.lineHeight === 'normal' ||
        Number.isNaN(parsedLineHeight)
      ) {
        return fontSize * 1.5;
      }

      return computedStyle.lineHeight.endsWith('px')
        ? parsedLineHeight
        : parsedLineHeight * fontSize;
    })();
    const nextMaxHeight = lineHeight * effectiveCollapsedLineCount;

    setCollapsedMaxHeight(nextMaxHeight);
    setIsOverflowing(el.scrollHeight - nextMaxHeight > OVERFLOW_TOLERANCE);
  }, [effectiveCollapsedLineCount]);

  useEffect(() => {
    setIsCollapsed(true);
  }, [effectiveCollapsedLineCount, text]);

  useEffect(() => {
    measureOverflow();

    const el = textRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(measureOverflow);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [measureOverflow, text]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => !current);
  }, []);

  return {
    textRef,
    isTextCollapsed: isCollapsed && isOverflowing,
    isOverflowing,
    collapsedMaxHeight,
    isCollapsed,
    toggleCollapsed,
  };
};
