import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CreatedResourceMemory } from '../created-resource-memory';
import { useCreatedResourceMemory } from '../useCreatedResourceMemory/useCreatedResourceMemory';

describe('useCreatedResourceMemory', () => {
  it('returns one memory that survives re-renders', () => {
    const { result, rerender } = renderHook(() => useCreatedResourceMemory());
    const first = result.current;
    first.remember({ id: 'a', folderKey: '' });

    rerender();

    expect(result.current).toBe(first);
    expect(result.current).toBeInstanceOf(CreatedResourceMemory);
    expect(result.current.get()).toEqual({ id: 'a', folderKey: '' });
  });

  it('gives each component its own memory', () => {
    const one = renderHook(() => useCreatedResourceMemory()).result.current;
    const two = renderHook(() => useCreatedResourceMemory()).result.current;
    expect(one).not.toBe(two);
  });
});
