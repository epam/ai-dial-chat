import { useEffect, useRef, useState } from 'react';

const DEFAULT_STREAM_CHARACTERS_PER_SECOND = 120;
const FINAL_STREAM_CHARACTERS_PER_SECOND = 800;

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

export const useStreamedMarkdownContent = (
  content: string,
  isStreaming = false,
  charactersPerSecond = DEFAULT_STREAM_CHARACTERS_PER_SECOND,
) => {
  const [displayedContent, setDisplayedContent] = useState(content);
  const displayedRef = useRef(content);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const pendingCharactersRef = useRef(0);

  useEffect(() => {
    const syncContent = () => {
      displayedRef.current = content;
      setDisplayedContent(content);
    };

    const cancelFrame = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameRef.current = null;
      pendingCharactersRef.current = 0;
    };

    if (shouldReduceMotion()) {
      cancelFrame();
      syncContent();
      return cancelFrame;
    }

    if (
      displayedRef.current === content ||
      !content.startsWith(displayedRef.current)
    ) {
      cancelFrame();
      syncContent();
      return cancelFrame;
    }

    const remainingContent = content.slice(displayedRef.current.length);
    if (hasStructuralMarkdown(remainingContent)) {
      cancelFrame();
      syncContent();
      return cancelFrame;
    }

    const effectiveCharactersPerSecond = isStreaming
      ? charactersPerSecond
      : FINAL_STREAM_CHARACTERS_PER_SECOND;
    const charactersPerMillisecond =
      Math.max(1, effectiveCharactersPerSecond) / 1000;

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
