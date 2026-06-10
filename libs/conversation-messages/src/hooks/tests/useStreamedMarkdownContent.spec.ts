import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStreamedMarkdownContent } from '../useStreamedMarkdownContent';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useStreamedMarkdownContent', () => {
  it('reveals appended content gradually while streaming', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamedMarkdownContent(content, isStreaming),
      {
        initialProps: { content: 'Hi', isStreaming: true },
      },
    );

    rerender({ content: 'Hi there', isStreaming: true });

    expect(result.current).toBe('Hi');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe('Hi there');
  });

  it('continues reveal after streaming stops using final speed', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamedMarkdownContent(content, isStreaming),
      {
        initialProps: { content: 'Hi', isStreaming: true },
      },
    );

    rerender({ content: 'Hi there', isStreaming: true });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ content: 'Hi there friend', isStreaming: false });

    expect(result.current).not.toBe('Hi there friend');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('Hi there friend');
  });

  it('syncs structural markdown immediately', () => {
    vi.useFakeTimers();
    const table = 'Intro\n\n| A | B |\n| - | - |\n| 1 | 2 |';

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamedMarkdownContent(content, isStreaming),
      {
        initialProps: { content: 'Intro', isStreaming: true },
      },
    );

    rerender({ content: table, isStreaming: true });

    expect(result.current).toBe(table);
  });

  it('syncs fenced code blocks immediately', () => {
    vi.useFakeTimers();
    const codeBlock = 'Intro\n\n```ts\nconst value = 1;\n```';

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamedMarkdownContent(content, isStreaming),
      {
        initialProps: { content: 'Intro', isStreaming: true },
      },
    );

    rerender({ content: codeBlock, isStreaming: true });

    expect(result.current).toBe(codeBlock);
  });

  it('syncs immediately when reduced motion is preferred', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
      }),
    });

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamedMarkdownContent(content, isStreaming),
      {
        initialProps: { content: 'Hi', isStreaming: true },
      },
    );

    rerender({ content: 'Hi there', isStreaming: true });

    expect(result.current).toBe('Hi there');
  });

  it('syncs immediately when content is replaced instead of appended', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ content, isStreaming }) =>
        useStreamedMarkdownContent(content, isStreaming),
      {
        initialProps: { content: 'Hi', isStreaming: true },
      },
    );

    rerender({ content: 'Bye', isStreaming: true });

    expect(result.current).toBe('Bye');
  });
});
