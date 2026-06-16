import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCitationPopup } from '../useCitationPopup';

const URL_A = 'https://files.example.com/a.pdf';
const URL_B = 'https://files.example.com/b.pdf';

describe('useCitationPopup', () => {
  it('initially no popup is open', () => {
    const { result } = renderHook(() => useCitationPopup());
    expect(result.current.isOpen(URL_A)).toBe(false);
  });

  it('openPopup sets the open state for that source URL', () => {
    const { result } = renderHook(() => useCitationPopup());
    act(() => result.current.openPopup(URL_A));
    expect(result.current.isOpen(URL_A)).toBe(true);
    expect(result.current.isOpen(URL_B)).toBe(false);
  });

  it('closePopup clears the open state', () => {
    const { result } = renderHook(() => useCitationPopup());
    act(() => result.current.openPopup(URL_A));
    act(() => result.current.closePopup());
    expect(result.current.isOpen(URL_A)).toBe(false);
  });

  it('setActiveIndex tracks index per group', () => {
    const { result } = renderHook(() => useCitationPopup());
    act(() => result.current.setActiveIndex(URL_A, 2));
    expect(result.current.getActiveIndex(URL_A)).toBe(2);
    expect(result.current.getActiveIndex(URL_B)).toBe(0); // default
  });

  it('opening a different popup replaces the previous one', () => {
    const { result } = renderHook(() => useCitationPopup());
    act(() => result.current.openPopup(URL_A));
    act(() => result.current.openPopup(URL_B));
    expect(result.current.isOpen(URL_A)).toBe(false);
    expect(result.current.isOpen(URL_B)).toBe(true);
  });
});
