import {
  OnboardingHintTarget,
  type OnboardingHintDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONBOARDING_RETRY_INTERVAL_MS,
  ONBOARDING_START_DELAY_MS,
  useOnboardingHints,
  type UseOnboardingHintsOptions,
} from '../useOnboardingHints';

const hint = (
  id: string,
  target: OnboardingHintTarget,
  title: string,
): OnboardingHintDto => ({ id, target, title, description: null });

const HINTS = [
  hint('new-chat', OnboardingHintTarget.NewChat, 'Start a chat'),
  hint('catalog', OnboardingHintTarget.CatalogCreate, 'Create an agent'),
];

describe('useOnboardingHints', () => {
  const element = document.createElement('button');
  let onScreen: Set<OnboardingHintTarget>;

  const renderHints = (options: Partial<UseOnboardingHintsOptions> = {}) =>
    renderHook(
      (props: UseOnboardingHintsOptions) => useOnboardingHints(props),
      {
        initialProps: {
          hints: HINTS,
          seenIds: [],
          onSeenIdsChange: vi.fn(),
          resolveTarget: (target) => (onScreen.has(target) ? element : null),
          isEnabled: true,
          ...options,
        },
      },
    );

  beforeEach(() => {
    vi.useFakeTimers();
    onScreen = new Set([OnboardingHintTarget.NewChat]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the unseen hints on screen once the start delay passes', () => {
    const { result } = renderHints();
    expect(result.current.steps).toEqual([]);

    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps.map((step) => step.id)).toEqual(['new-chat']);
  });

  it('keeps looking while the page has no hint target yet', () => {
    onScreen = new Set();
    const { result } = renderHints();
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps).toEqual([]);

    onScreen.add(OnboardingHintTarget.CatalogCreate);
    act(() => vi.advanceTimersByTime(ONBOARDING_RETRY_INTERVAL_MS));
    expect(result.current.steps.map((step) => step.id)).toEqual(['catalog']);
  });

  it('skips hints the user has already seen', () => {
    const { result } = renderHints({ seenIds: ['new-chat'] });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps).toEqual([]);
  });

  it('starts nothing while disabled', () => {
    const { result } = renderHints({ isEnabled: false });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps).toEqual([]);
  });

  it('adds the shown ids to the seen ones and ends the tour', () => {
    const onSeenIdsChange = vi.fn();
    const { result } = renderHints({ seenIds: ['old'], onSeenIdsChange });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));

    act(() => result.current.onFinish(['new-chat']));
    expect(onSeenIdsChange).toHaveBeenCalledWith(['old', 'new-chat']);
    expect(result.current.steps).toEqual([]);
  });
});
