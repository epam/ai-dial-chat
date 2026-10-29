import { renderHook as render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  useLatestCanvasRequest,
  AttachmentCanvasProvider,
} from '../AttachmentCanvasContext';

const renderHook = <T>(callback: () => T) =>
  render(callback, { wrapper: AttachmentCanvasProvider });

describe('useLatestCanvasRequest', () => {
  it('lets the latest request commit', () => {
    const { result } = renderHook(() => useLatestCanvasRequest());

    const shouldCommit = result.current();

    expect(shouldCommit()).toBe(true);
  });

  it('stops an earlier request from committing once a later one starts', () => {
    const { result } = renderHook(() => useLatestCanvasRequest());

    const first = result.current();
    const second = result.current();

    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('supersedes a pending request when the later one never awaits anything', () => {
    const { result } = renderHook(() => useLatestCanvasRequest());

    const pending = result.current();
    result.current();

    expect(pending()).toBe(false);
  });

  it('supersedes requests started by another component instance', () => {
    const { result } = renderHook(() => ({
      a: useLatestCanvasRequest(),
      b: useLatestCanvasRequest(),
    }));
    const resultA = { current: result.current.a };
    const resultB = { current: result.current.b };

    const fromA = resultA.current();
    const fromB = resultB.current();

    expect(fromA()).toBe(false);
    expect(fromB()).toBe(true);
  });

  it('stops a request from committing after its component unmounts', () => {
    const { result, unmount } = renderHook(() => useLatestCanvasRequest());

    const shouldCommit = result.current();
    unmount();

    expect(shouldCommit()).toBe(false);
  });

  it('keeps the same function identity across renders', () => {
    const { result, rerender } = renderHook(() => useLatestCanvasRequest());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

it('keeps independent canvas providers independent', () => {
  const view = renderHook(() => useLatestCanvasRequest());
  const utils = renderHook(() => useLatestCanvasRequest());
  const a = view.result.current();
  const b = utils.result.current();
  expect(a()).toBe(true);
  expect(b()).toBe(true);
  utils.unmount();
  expect(a()).toBe(true);
  expect(b()).toBe(false);
});
