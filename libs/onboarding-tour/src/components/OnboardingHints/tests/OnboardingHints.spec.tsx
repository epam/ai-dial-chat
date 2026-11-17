import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ONBOARDING_START_DELAY_MS } from '../../../constants/timing';
import type { OnboardingHintsProps } from '../../../models/onboarding-tour';
import { OnboardingHints } from '../OnboardingHints';

const renderHints = (props: Partial<OnboardingHintsProps> = {}) =>
  render(
    <>
      <button type="button">New chat</button>
      <OnboardingHints
        hints={[{ id: 'new-chat', target: 'new-chat', title: 'Start a chat' }]}
        resolveTarget={(target) =>
          target === 'new-chat'
            ? screen.queryByRole('button', { name: 'New chat' })
            : null
        }
        anchorTargets={['new-chat', 'catalog']}
        seenIds={[]}
        onSeenIdsChange={vi.fn()}
        isEnabled
        {...props}
      />
    </>,
  );

describe('OnboardingHints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 10,
      width: 40,
      height: 20,
    } as DOMRect);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts a tour with the unseen hints on the page', () => {
    renderHints();
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(screen.getByRole('dialog', { name: 'Start a chat' })).toBeTruthy();
  });

  it('outlines the anchors instead of starting a tour in the anchor view', () => {
    const onCloseAnchorView = vi.fn();
    renderHints({ isAnchorView: true, onCloseAnchorView });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('catalog')).toBeTruthy();
  });
});
