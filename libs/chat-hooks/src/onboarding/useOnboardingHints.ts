import type {
  OnboardingHintDto,
  OnboardingHintTarget,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Delay, in ms, that lets a route render before hint targets are looked up. */
export const ONBOARDING_START_DELAY_MS = 800;
/** Interval, in ms, between lookups while the page is still loading its data. */
export const ONBOARDING_RETRY_INTERVAL_MS = 500;
/** Lookups made before a page with no hint target on screen is given up on. */
export const ONBOARDING_RETRY_ATTEMPTS = 20;

/** One hint ready to show: its copy and the lookup of the element it points at. */
export interface OnboardingHintStep {
  /** Stable id of the hint, from `OnboardingHintDto.id`. */
  id: string;
  /** Card heading. */
  title: string;
  /** Optional body text. */
  description?: string;
  /** Returns the element the hint points at, or `null` when it is not on screen. */
  getTarget: () => HTMLElement | null;
}

/** Options of `useOnboardingHints`. */
export interface UseOnboardingHintsOptions {
  /** Operator-configured hints, in order (`config.onboardingHints`). */
  hints: OnboardingHintDto[];
  /** Ids of the hints this user has already seen. */
  seenIds: string[];
  /** Called with the new list of seen ids once a tour ends; the host persists it. */
  onSeenIdsChange: (seenIds: string[]) => void;
  /** Returns the on-screen element of a target, or `null` when the page does not render it. */
  resolveTarget: (target: OnboardingHintTarget) => HTMLElement | null;
  /** `false` while the config is loading or the host shows something else instead of hints. */
  isEnabled: boolean;
  /** A value that changes on navigation, such as the pathname; each change looks for hints again. */
  pageKey?: unknown;
}

/** Return value of `useOnboardingHints`. */
export interface UseOnboardingHintsResult {
  /** Hints to pass to `OnboardingTour` as `steps`; empty while no tour runs. */
  steps: OnboardingHintStep[];
  /** Pass to `OnboardingTour` as `onFinish`: marks the shown ids seen and ends the tour. */
  onFinish: (shownIds: string[]) => void;
}

const NO_STEPS: OnboardingHintStep[] = [];

/**
 * Picks the unseen hints whose element is on the current page and starts a
 * tour with them; returns the steps and the finish handler for `OnboardingTour`.
 */
export const useOnboardingHints = ({
  hints,
  seenIds,
  onSeenIdsChange,
  resolveTarget,
  isEnabled,
  pageKey,
}: UseOnboardingHintsOptions): UseOnboardingHintsResult => {
  const [steps, setSteps] = useState<OnboardingHintStep[]>(NO_STEPS);

  /* One step object per hint, so its getTarget stays stable while it is shown. */
  const pendingSteps = useMemo<OnboardingHintStep[]>(
    () =>
      hints
        .filter((hint) => !seenIds.includes(hint.id))
        .map((hint) => ({
          id: hint.id,
          title: hint.title,
          description: hint.description ?? undefined,
          getTarget: () => resolveTarget(hint.target),
        })),
    [hints, seenIds, resolveTarget],
  );

  /* Look for unseen hints on every page, after it had a moment to paint, and
   * keep looking for a while: a page such as the catalog renders its controls
   * only once its data arrives. The tour shows the hints that are on screen;
   * the rest stay unseen until a page renders them. */
  const isRunning = steps.length > 0;
  useEffect(() => {
    if (!isEnabled || isRunning || pendingSteps.length === 0) {
      return;
    }
    let attempts = 0;
    let timer = 0;
    const tryStart = () => {
      const visible = pendingSteps.filter((step) => step.getTarget() != null);
      if (visible.length > 0) {
        setSteps(visible);
        return;
      }
      attempts += 1;
      if (attempts < ONBOARDING_RETRY_ATTEMPTS) {
        timer = window.setTimeout(tryStart, ONBOARDING_RETRY_INTERVAL_MS);
      }
    };
    timer = window.setTimeout(tryStart, ONBOARDING_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isEnabled, isRunning, pendingSteps, pageKey]);

  const onFinish = useCallback(
    (shownIds: string[]) => {
      onSeenIdsChange([
        ...seenIds.filter((id) => !shownIds.includes(id)),
        ...shownIds,
      ]);
      setSteps(NO_STEPS);
    },
    [seenIds, onSeenIdsChange],
  );

  return { steps, onFinish };
};
