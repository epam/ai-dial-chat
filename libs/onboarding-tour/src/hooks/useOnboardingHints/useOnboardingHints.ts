import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /* Closing a tour (the close button, Escape) puts the onboarding off until
   * the host remounts the hook, usually the next visit: the hints not passed
   * stay unseen, but no card opens again on this page or the next one. */
  const [isClosed, setIsClosed] = useState(false);

  /* The latest seen ids, including the ones just reported: two quick Next
   * presses must not each start from a `seenIds` the host has not re-rendered
   * with yet, or the second would drop the first. */
  const seenIdsRef = useRef(seenIds);
  useEffect(() => {
    seenIdsRef.current = seenIds;
  }, [seenIds]);

  const markSeen = useCallback(
    (ids: string[]) => {
      const current = seenIdsRef.current;
      const next = [...current.filter((id) => !ids.includes(id)), ...ids];
      seenIdsRef.current = next;
      onSeenIdsChange(next);
    },
    [onSeenIdsChange],
  );

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

  /* Leaving the page ends a running tour: its remaining steps point at
   * elements the next page does not render. Steps already passed with Next
   * were marked seen then; the rest stay unseen. */
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
    if (!isEnabled || isClosed || isRunning || pendingSteps.length === 0) {
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
  }, [isEnabled, isClosed, isRunning, pendingSteps, pageKey]);

  /* Each Next marks the step just passed, so a tour left halfway (another
   * page, a reload, a closed tab) resumes from the first step not passed. */
  const onStepComplete = useCallback(
    (stepId: string) => {
      if (!seenIdsRef.current.includes(stepId)) {
        markSeen([stepId]);
      }
    },
    [markSeen],
  );

  /* Done and close mark the hints that were shown; Skip opts out of every
   * configured hint, so no later page starts a new tour. Close also puts the
   * remaining hints off until the next visit. */
  const onFinish = useCallback(
    (shownIds: string[], reason: OnboardingTourEndReason) => {
      markSeen(
        reason === OnboardingTourEndReason.Skipped
          ? [...new Set([...shownIds, ...hints.map(({ id }) => id)])]
          : shownIds,
      );
      if (reason === OnboardingTourEndReason.Closed) {
        setIsClosed(true);
      }
      setSteps(NO_STEPS);
    },
    [hints, markSeen],
  );

  return { steps, onFinish, onStepComplete };
};
