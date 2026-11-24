import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHasBeenTrue } from '../useHasBeenTrue';

describe('useHasBeenTrue', () => {
  it('stays false while the value has never been true', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useHasBeenTrue(value),
      { initialProps: { value: false } },
    );

    rerender({ value: false });

    expect(result.current).toBe(false);
  });

  it('turns true in the same render the value first turns true', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useHasBeenTrue(value),
      { initialProps: { value: false } },
    );

    rerender({ value: true });

    expect(result.current).toBe(true);
  });

  it('stays true after the value returns to false', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useHasBeenTrue(value),
      { initialProps: { value: true } },
    );

    rerender({ value: false });
    rerender({ value: false });

    expect(result.current).toBe(true);
  });
});
