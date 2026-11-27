import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONBOARDING_RETRY_INTERVAL_MS,
  ONBOARDING_START_DELAY_MS,
} from '../../../constants/timing';
import type {
  OnboardingHint,
  UseOnboardingHintsOptions,
} from '../../../models/onboarding-tour';
import { OnboardingTourEndReason } from '../../../types/onboarding-tour-end-reason';
import { useOnboardingHints } from '../useOnboardingHints';

const hint = (id: string, target: string, title: string): OnboardingHint => ({
  id,
  target,
  title,
  description: null,
});

const HINTS = [
  hint('new-chat', 'new-chat', 'Start a chat'),
  hint('catalog', 'catalog-create', 'Create an agent'),
];

describe('useOnboardingHints', () => {
  const element = document.createElement('button');
  let onScreen: Set<string>;

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
    onScreen = new Set(['new-chat']);
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

    onScreen.add('catalog-create');
    act(() => vi.advanceTimersByTime(ONBOARDING_RETRY_INTERVAL_MS));
    expect(result.current.steps.map((step) => step.id)).toEqual(['catalog']);
  });

  it('skips hints the user has already seen', () => {
    const { result } = renderHints({ seenIds: ['new-chat'] });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps).toEqual([]);
  });

  it('leaves out the hints that do not belong to the page', () => {
    onScreen = new Set(['new-chat', 'catalog-create']);
    const { result } = renderHints({
      isHintOnPage: (hint) => hint.id !== 'new-chat',
    });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps.map((step) => step.id)).toEqual(['catalog']);
  });

  it('starts each page tour with only the hints not seen yet', () => {
    onScreen = new Set(['new-chat', 'catalog-create']);
    const { result } = renderHints({ seenIds: ['new-chat', 'other-page'] });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps.map((step) => step.id)).toEqual(['catalog']);
    expect(result.current).not.toHaveProperty('completedStepCount');
  });

  it('marks hints of other pages seen too when the tour is skipped', () => {
    const onSeenIdsChange = vi.fn();
    const { result } = renderHints({
      onSeenIdsChange,
      isHintOnPage: (hint) => hint.id === 'new-chat',
    });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    act(() =>
      result.current.onFinish(['new-chat'], OnboardingTourEndReason.Skipped),
    );
    expect(onSeenIdsChange).toHaveBeenCalledWith(['new-chat', 'catalog']);
  });

  it('starts nothing while disabled', () => {
    const { result } = renderHints({ isEnabled: false });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps).toEqual([]);
  });

  it('adds the shown ids to the seen ones when the tour is done', () => {
    const onSeenIdsChange = vi.fn();
    const { result } = renderHints({ seenIds: ['old'], onSeenIdsChange });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));

    act(() =>
      result.current.onFinish(['new-chat'], OnboardingTourEndReason.Done),
    );
    expect(onSeenIdsChange).toHaveBeenCalledWith(['old', 'new-chat']);
    expect(result.current.steps).toEqual([]);
  });

  it('marks every configured hint seen when the tour is skipped', () => {
    const onSeenIdsChange = vi.fn();
    const { result } = renderHints({ onSeenIdsChange });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));

    act(() =>
      result.current.onFinish(['new-chat'], OnboardingTourEndReason.Skipped),
    );
    expect(onSeenIdsChange).toHaveBeenCalledWith(['new-chat', 'catalog']);
  });

  it('marks nothing seen and opens no new tour when closed', () => {
    const onSeenIdsChange = vi.fn();
    const { result, rerender } = renderHints({ onSeenIdsChange });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));

    act(() =>
      result.current.onFinish(['new-chat'], OnboardingTourEndReason.Closed),
    );
    expect(onSeenIdsChange).not.toHaveBeenCalled();
    expect(result.current.steps).toEqual([]);

    onScreen.add('catalog-create');
    rerender({
      hints: HINTS,
      seenIds: [],
      onSeenIdsChange,
      resolveTarget: (target) => (onScreen.has(target) ? element : null),
      isEnabled: true,
      pageKey: '/catalog',
    });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps).toEqual([]);
  });

  it('opens the tour again on the closed hint after a remount', () => {
    const onSeenIdsChange = vi.fn();
    const view = renderHints({ onSeenIdsChange });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    act(() =>
      view.result.current.onFinish(
        ['new-chat'],
        OnboardingTourEndReason.Closed,
      ),
    );
    view.unmount();

    const { result } = renderHints({ onSeenIdsChange });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps.map((step) => step.id)).toEqual(['new-chat']);
  });

  it('marks each step seen as soon as the user moves past it', () => {
    const onSeenIdsChange = vi.fn();
    const { result } = renderHints({ seenIds: ['old'], onSeenIdsChange });
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));

    act(() => result.current.onStepComplete('new-chat'));
    expect(onSeenIdsChange).toHaveBeenLastCalledWith(['old', 'new-chat']);
    expect(result.current.steps.map((step) => step.id)).toEqual(['new-chat']);

    act(() => result.current.onStepComplete('new-chat'));
    expect(onSeenIdsChange).toHaveBeenCalledOnce();
  });

  it('keeps every passed step when the host has not re-rendered in between', () => {
    const onSeenIdsChange = vi.fn();
    const { result } = renderHints({ onSeenIdsChange });

    act(() => {
      result.current.onStepComplete('new-chat');
      result.current.onStepComplete('catalog');
    });
    expect(onSeenIdsChange).toHaveBeenLastCalledWith(['new-chat', 'catalog']);
  });

  it('ends a running tour without marking anything when the page changes', () => {
    const onSeenIdsChange = vi.fn();
    const { result, rerender } = renderHook(
      (props: UseOnboardingHintsOptions) => useOnboardingHints(props),
      {
        initialProps: {
          hints: HINTS,
          seenIds: [],
          onSeenIdsChange,
          resolveTarget: (target: string) =>
            onScreen.has(target) ? element : null,
          isEnabled: true,
          pageKey: '/',
        },
      },
    );
    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS));
    expect(result.current.steps).toHaveLength(1);

    onScreen = new Set();
    rerender({
      hints: HINTS,
      seenIds: [],
      onSeenIdsChange,
      resolveTarget: (target: string) =>
        onScreen.has(target) ? element : null,
      isEnabled: true,
      pageKey: '/catalog',
    });
    expect(result.current.steps).toEqual([]);
    expect(onSeenIdsChange).not.toHaveBeenCalled();
  });

  it('waits while the user is typing and keeps their focus', () => {
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    const { result } = renderHints();

    act(() => vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS * 20));
    expect(result.current.steps).toEqual([]);
    // eslint-disable-next-line testing-library/no-node-access -- focus placement has no query; the focused element is the assertion
    expect(document.activeElement).toBe(field);

    field.blur();
    act(() => vi.advanceTimersByTime(ONBOARDING_RETRY_INTERVAL_MS));
    expect(result.current.steps.map((step) => step.id)).toEqual(['new-chat']);
    field.remove();
  });
});
