import { useEffect, useRef, useState } from 'react';

const DEFAULT_STREAM_CHARACTERS_PER_SECOND = 120;

const shouldReduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const getNextStreamedContent = (
  current: string,
  target: string,
  characterCount: number,
) => {
  if (!target.startsWith(current)) return target;
  return target.slice(0, current.length + characterCount);
};

const hasMarkdownTableRow = (content: string) =>
  content.split('\n').some((line) => {
    const trimmedLine = line.trim();
    return (
      trimmedLine.length > 1 &&
      trimmedLine.startsWith('|') &&
      trimmedLine.endsWith('|')
    );
  });

const hasStructuralMarkdown = (content: string) =>
  content.includes('```') || hasMarkdownTableRow(content);

/*
 * Plain appended text is animated only while streaming. Final content is
 * synced immediately so parent scroll layout effects see the completed DOM.
 */
const shouldSyncInstantly = (
  displayed: string,
  content: string,
  isStreaming: boolean,
): boolean =>
  !isStreaming ||
  shouldReduceMotion() ||
  displayed === content ||
  !content.startsWith(displayed) ||
  hasStructuralMarkdown(content.slice(displayed.length));

/** Gradually reveals appended markdown content while streaming, syncing instantly on completion or when a code block/table is mid-stream. */
export const useStreamedMarkdownContent = (
  content: string,
  isStreaming = false,
  charactersPerSecond = DEFAULT_STREAM_CHARACTERS_PER_SECOND,
) => {
  const [displayedContent, setDisplayedContent] = useState(content);
  const displayedRef = useRef(content);
  const prevContentRef = useRef(content);
  const prevIsStreamingRef = useRef(isStreaming);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const pendingCharactersRef = useRef(0);

  /*
   * React supports render-time state sync for derived state. Canceling the
   * queued frame here also prevents an older animation closure from writing
   * stale content after an instant sync.
   */
  if (
    content !== prevContentRef.current ||
    isStreaming !== prevIsStreamingRef.current
  ) {
    prevContentRef.current = content;
    prevIsStreamingRef.current = isStreaming;
    if (shouldSyncInstantly(displayedRef.current, content, isStreaming)) {
      displayedRef.current = content;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameRef.current = null;
      pendingCharactersRef.current = 0;
      if (displayedContent !== content) {
        setDisplayedContent(content);
      }
    }
  }

  useEffect(() => {
    const cancelFrame = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameRef.current = null;
      pendingCharactersRef.current = 0;
    };

    if (
      !isStreaming ||
      displayedRef.current === content ||
      !content.startsWith(displayedRef.current)
    ) {
      cancelFrame();
      return cancelFrame;
    }

    const charactersPerMillisecond = Math.max(1, charactersPerSecond) / 1000;

    const animate = (timestamp: number) => {
      const previousTimestamp = lastFrameRef.current ?? timestamp;
      const elapsed = timestamp - previousTimestamp;
      lastFrameRef.current = timestamp;
      pendingCharactersRef.current += elapsed * charactersPerMillisecond;

      const charactersToReveal = Math.floor(pendingCharactersRef.current);
      if (charactersToReveal > 0) {
        pendingCharactersRef.current -= charactersToReveal;
        const nextContent = getNextStreamedContent(
          displayedRef.current,
          content,
          charactersToReveal,
        );
        displayedRef.current = nextContent;
        setDisplayedContent(nextContent);
      }

      if (displayedRef.current !== content) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        cancelFrame();
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return cancelFrame;
  }, [charactersPerSecond, content, isStreaming]);

  return displayedContent;
};
