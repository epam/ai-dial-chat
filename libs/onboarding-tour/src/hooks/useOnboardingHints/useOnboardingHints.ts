import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ONBOARDING_RETRY_ATTEMPTS,
  ONBOARDING_RETRY_INTERVAL_MS,
  ONBOARDING_START_DELAY_MS,
} from '../../constants/timing';
import type {
  OnboardingTourStep,
  UseOnboardingHintsOptions,
  UseOnboardingHintsResult,
} from '../../models/onboarding-tour';
import { OnboardingTourEndReason } from '../../types/onboarding-tour-end-reason';
import { isEditableElement } from '../../utils/focus';

const NO_STEPS: OnboardingTourStep[] = [];

/** Picks the unseen hints whose element is on the current page and returns the steps and finish handler for `OnboardingTour`. */
export const useOnboardingHints = ({
  hints,
  seenIds,
  onSeenIdsChange,
  resolveTarget,
  isEnabled,
  pageKey,
}: UseOnboardingHintsOptions): UseOnboardingHintsResult => {
  const [steps, setSteps] = useState<OnboardingTourStep[]>(NO_STEPS);

  /* One step object per hint, so its getTarget stays stable while it is shown. */
  const pendingSteps = useMemo<OnboardingTourStep[]>(
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

  /* Leaving the page ends a running tour without marking anything seen: its
   * remaining steps point at elements the next page does not render. */
  useEffect(() => {
    setSteps(NO_STEPS);
  }, [pageKey]);

  /* Look for unseen hints on every page, after it had a moment to paint, and
   * keep looking for a while: a page such as the catalog renders its controls
   * only once its data arrives. The tour shows the hints that are on screen;
   * the rest stay unseen until a page renders them. A tour never opens while
   * the user is typing: it would take their focus and keystrokes. */
  const isRunning = steps.length > 0;
  useEffect(() => {
    if (!isEnabled || isRunning || pendingSteps.length === 0) {
      return;
    }
    let attempts = 0;
    let timer = 0;
    const tryStart = () => {
      if (isEditableElement(document.activeElement)) {
        timer = window.setTimeout(tryStart, ONBOARDING_RETRY_INTERVAL_MS);
        return;
      }
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

  /* Done marks the hints that were shown; dismissing the tour (Skip, close,
   * Escape) opts out of every configured hint, so no later page starts a new
   * tour. */
  const onFinish = useCallback(
    (shownIds: string[], reason: OnboardingTourEndReason) => {
      const newlySeen =
        reason === OnboardingTourEndReason.Dismissed
          ? [...new Set([...shownIds, ...hints.map(({ id }) => id)])]
          : shownIds;
      onSeenIdsChange([
        ...seenIds.filter((id) => !newlySeen.includes(id)),
        ...newlySeen,
      ]);
      setSteps(NO_STEPS);
    },
    [hints, seenIds, onSeenIdsChange],
  );

  return { steps, onFinish };
};
