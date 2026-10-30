import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useHtmlTagAnnotationGroups } from '../useHtmlTagAnnotationGroups';
it('ignores malformed input and preserves empty identity', () => {
  const { result, rerender } = renderHook(
    ({ input }) => useHtmlTagAnnotationGroups(input),
    { initialProps: { input: undefined as unknown } },
  );
  const empty = result.current;
  rerender({
    input: [null, 1, {}, { target: { selector: { type: 'other' } } }],
  });
  expect(result.current).toBe(empty);
});
it('groups supported selectors and memoizes unchanged input', () => {
  const input = [
    {
      target: { selector: { type: 'html_tag', tag: 'cit', id: 'a' } },
      body: { source: { attachment: { url: 'https://example.com/a' } } },
    },
  ];
  const { result, rerender } = renderHook(() =>
    useHtmlTagAnnotationGroups(input),
  );
  const groups = result.current;
  expect(groups).toHaveLength(1);
  rerender();
  expect(result.current).toBe(groups);
});

it('ignores invalid selector ids and attachment values', () => {
  const values = [
    {
      target: { selector: { type: 'html_tag', id: {} } },
      body: { source: { attachment: { url: 'url' } } },
    },
    {
      target: { selector: { type: 'html_tag', id: 'a' } },
      body: { source: { attachment: { url: 123 } } },
    },
  ];
  const { result } = renderHook(() => useHtmlTagAnnotationGroups(values));
  expect(result.current).toEqual([]);
});
