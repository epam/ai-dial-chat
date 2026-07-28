import { useCallback, useEffect, useState } from 'react';

const DEFAULT_LINE_HEIGHT_FALLBACK = 24;
const OVERFLOW_TOLERANCE = 1;

/** Options for `useCollapsedText`. */
export interface UseCollapsedTextOptions {
  /** Content identity used to reset long text to the collapsed state when it changes. */
  text: string;
  /** Maximum number of text lines shown while collapsed. */
  collapsedLineCount: number;
}

export interface UseCollapsedTextResult<T extends HTMLElement> {
  /** Ref callback attached to the text element to measure its rendered height. */
  textRef: (node: T | null) => void;
  /** Whether the full text is currently hidden behind the collapsed viewport. */
  isTextCollapsed: boolean;
  /** Whether the measured text is taller than the collapsed viewport. */
  isOverflowing: boolean;
  /** Current collapsed viewport height in pixels. */
  collapsedMaxHeight: number;
  /** Full rendered text height in pixels. */
  expandedMaxHeight: number;
  /** Whether the expanded/collapsed control is currently in the collapsed state. */
  isCollapsed: boolean;
  /** Toggle between expanded and collapsed states. */
  toggleCollapsed: () => void;
}

/** Measures rendered text and owns the expand/collapse state for long plain-text content. */
export const useCollapsedText = <T extends HTMLElement = HTMLElement>({
  text,
  collapsedLineCount,
}: UseCollapsedTextOptions): UseCollapsedTextResult<T> => {
  const effectiveCollapsedLineCount = Math.max(1, collapsedLineCount);
  const [node, setNode] = useState<T | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(
    DEFAULT_LINE_HEIGHT_FALLBACK * effectiveCollapsedLineCount,
  );
  const [expandedMaxHeight, setExpandedMaxHeight] = useState(0);

  const textRef = useCallback((next: T | null) => {
    setNode(next);
  }, []);

  const measureOverflow = useCallback(() => {
    if (!node) return;

    const computedStyle = window.getComputedStyle(node);
    const parsedFontSize = Number.parseFloat(computedStyle.fontSize);
    const fontSize = Number.isNaN(parsedFontSize) ? 16 : parsedFontSize;
    const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
    let lineHeight = fontSize * 1.5;

    if (
      computedStyle.lineHeight !== 'normal' &&
      !Number.isNaN(parsedLineHeight)
    ) {
      lineHeight = computedStyle.lineHeight.endsWith('px')
        ? parsedLineHeight
        : parsedLineHeight * fontSize;
    }

    const nextMaxHeight = lineHeight * effectiveCollapsedLineCount;

    setCollapsedMaxHeight(nextMaxHeight);
    setExpandedMaxHeight(node.scrollHeight);
    setIsOverflowing(node.scrollHeight - nextMaxHeight > OVERFLOW_TOLERANCE);
  }, [node, effectiveCollapsedLineCount]);

  useEffect(() => {
    setIsCollapsed(true);
  }, [effectiveCollapsedLineCount, text]);

  useEffect(() => {
    measureOverflow();

    if (!node || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(measureOverflow);
    resizeObserver.observe(node);

    return () => resizeObserver.disconnect();
  }, [measureOverflow, node, text]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => !current);
  }, []);

  return {
    textRef,
    isTextCollapsed: isCollapsed && isOverflowing,
    isOverflowing,
    collapsedMaxHeight,
    expandedMaxHeight,
    isCollapsed,
    toggleCollapsed,
  };
};
