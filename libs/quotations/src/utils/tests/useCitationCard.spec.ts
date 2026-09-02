import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCitationCard } from '../useCitationCard';

const GROUP_KEY_A = 'https://files.example.com/a.pdf';
const GROUP_KEY_B = 'https://files.example.com/b.pdf';

describe('useCitationCard', () => {
  it('initially no popup is open', () => {
    const { result } = renderHook(() => useCitationCard());
    expect(result.current.isOpen(GROUP_KEY_A)).toBe(false);
  });

  it('openPopup sets the open state for that groupKey', () => {
    const { result } = renderHook(() => useCitationCard());
    act(() => result.current.openPopup(GROUP_KEY_A));
    expect(result.current.isOpen(GROUP_KEY_A)).toBe(true);
    expect(result.current.isOpen(GROUP_KEY_B)).toBe(false);
  });

  it('closePopup clears the open state', () => {
    const { result } = renderHook(() => useCitationCard());
    act(() => result.current.openPopup(GROUP_KEY_A));
    act(() => result.current.closePopup());
    expect(result.current.isOpen(GROUP_KEY_A)).toBe(false);
  });

  it('setActiveIndex tracks index per groupKey', () => {
    const { result } = renderHook(() => useCitationCard());
    act(() => result.current.setActiveIndex(GROUP_KEY_A, 2));
    expect(result.current.getActiveIndex(GROUP_KEY_A)).toBe(2);
    expect(result.current.getActiveIndex(GROUP_KEY_B)).toBe(0); // default
  });

  it('opening a different popup replaces the previous one', () => {
    const { result } = renderHook(() => useCitationCard());
    act(() => result.current.openPopup(GROUP_KEY_A));
    act(() => result.current.openPopup(GROUP_KEY_B));
    expect(result.current.isOpen(GROUP_KEY_A)).toBe(false);
    expect(result.current.isOpen(GROUP_KEY_B)).toBe(true);
  });

  it('two groupKeys derived from the same sourceUrl have independent state', () => {
    /* e.g. two cit-id groups ("cit:e1", "cit:e2") citing the same document. */
    const CIT_KEY_1 = 'cit:e1';
    const CIT_KEY_2 = 'cit:e2';
    const { result } = renderHook(() => useCitationCard());
    act(() => result.current.openPopup(CIT_KEY_1));
    act(() => result.current.setActiveIndex(CIT_KEY_1, 3));
    expect(result.current.isOpen(CIT_KEY_1)).toBe(true);
    expect(result.current.isOpen(CIT_KEY_2)).toBe(false);
    expect(result.current.getActiveIndex(CIT_KEY_1)).toBe(3);
    expect(result.current.getActiveIndex(CIT_KEY_2)).toBe(0);
  });
});
