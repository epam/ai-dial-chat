import { OnboardingHintsMode } from '@epam/ai-dial-chat-api-client';
import { useIsMobile } from '@epam/ai-dial-chat-shared';
import {
  OnboardingAnchorMap,
  OnboardingBeacons,
  OnboardingTour,
  type OnboardingAnchor,
  type OnboardingAnchorMapLabels,
  type OnboardingBeaconsLabels,
  type OnboardingTourLabels,
  type OnboardingTourStep,
} from '@epam/ai-dial-onboarding-tour';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  NavigationI18nKeys,
  OnboardingTourI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { StorageKey } from '../../types/storage-key';
import { UserConfigStatus } from '../../types/user-config-status';
import {
  ONBOARDING_ANCHOR_TARGETS,
  resolveOnboardingTarget,
  type OnboardingTargetLabels,
} from './onboarding-targets';

/* Lets a route render before targets are looked up. */
export const ONBOARDING_START_DELAY_MS = 800;
/* Then keeps looking for about ten seconds while the page loads its data. */
export const ONBOARDING_RETRY_INTERVAL_MS = 500;
const ONBOARDING_RETRY_ATTEMPTS = 20;

const NO_STEPS: OnboardingTourStep[] = [];

/* `?onboarding-anchors` in the URL outlines every anchor on the page instead
 * of showing hints, so an operator can see what a hint's target points at. */
export const ONBOARDING_ANCHORS_PARAM = 'onboarding-anchors';

/**
 * First-visit onboarding: feeds the operator-configured `onboardingHints`
 * whose element is on screen to the `OnboardingTour` lib, or, in
 * `beacons` mode, every unseen hint to `OnboardingBeacons`. Finishing or
 * skipping the tour stores the shown ids in `localStorage`, so a hint is seen
 * once per browser and a new id is shown on the next visit. Hints whose
 * element is not on screen wait for a page that renders it.
 */
const OnboardingHints: FC = () => {
  const { t, i18n } = useTranslation();
  const { status, config } = useAppConfig();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAnchorView = searchParams.has(ONBOARDING_ANCHORS_PARAM);
  const [seenIds, setSeenIds] = useLocalStorage<string[]>(
    StorageKey.SeenOnboardingHints,
    [],
  );
  const [steps, setSteps] = useState<OnboardingTourStep[]>(NO_STEPS);

  /* Keyed on the strings, not on `t`, so the effect below reruns only when
   * the language actually changes. */
  const targetLabelsKey = JSON.stringify({
    newChat: t(ButtonsI18nKeys.NewChat),
    navigation: t(NavigationI18nKeys.AriaLabel),
    projects: t(NavigationI18nKeys.Projects),
    scheduledTasks: t(NavigationI18nKeys.ScheduledTasks),
    catalog: t(NavigationI18nKeys.Catalog),
    fileManager: t(NavigationI18nKeys.FileManager),
    addAttachment: t(ButtonsI18nKeys.Add),
    catalogCreate: t(ButtonsI18nKeys.Create),
    catalogViewMode: t(CatalogI18nKeys.ViewToggleLabel),
  } satisfies OnboardingTargetLabels);
  const targetLabels = useMemo(
    () => JSON.parse(targetLabelsKey) as OnboardingTargetLabels,
    [targetLabelsKey],
  );

  const labels = useMemo<OnboardingTourLabels>(
    () => ({
      stepCounter: (current, total) =>
        t(OnboardingTourI18nKeys.StepCounter, { current, total }),
      next: t(OnboardingTourI18nKeys.Next),
      back: t(OnboardingTourI18nKeys.Back),
      done: t(OnboardingTourI18nKeys.Done),
      skip: t(OnboardingTourI18nKeys.Skip),
      close: t(OnboardingTourI18nKeys.Close),
    }),
    [t],
  );
  const beaconLabels = useMemo<OnboardingBeaconsLabels>(
    () => ({
      beacon: (title) => t(OnboardingTourI18nKeys.Beacon, { title }),
      gotIt: t(OnboardingTourI18nKeys.GotIt),
    }),
    [t],
  );

  const anchorMapLabels = useMemo<OnboardingAnchorMapLabels>(
    () => ({
      summary: (found, total) =>
        t(OnboardingTourI18nKeys.AnchorsSummary, { found, total }),
      missingHeading: t(OnboardingTourI18nKeys.AnchorsMissing),
      noneMissing: t(OnboardingTourI18nKeys.AnchorsNoneMissing),
      close: t(OnboardingTourI18nKeys.AnchorsClose),
    }),
    [t],
  );
  const anchors = useMemo<OnboardingAnchor[]>(
    () =>
      ONBOARDING_ANCHOR_TARGETS.map((target) => ({
        id: target,
        getTarget: () => resolveOnboardingTarget(target, targetLabels),
      })),
    [targetLabels],
  );

  const isBeacons = config.onboardingHintsMode === OnboardingHintsMode.Beacons;
  const pendingHints = useMemo(
    () => config.onboardingHints.filter((hint) => !seenIds.includes(hint.id)),
    [config.onboardingHints, seenIds],
  );
  /* One step object per hint, so its getTarget stays stable while it is shown. */
  const pendingSteps = useMemo<OnboardingTourStep[]>(
    () =>
      pendingHints.map((hint) => ({
        id: hint.id,
        title: hint.title,
        description: hint.description ?? undefined,
        getTarget: () => resolveOnboardingTarget(hint.target, targetLabels),
      })),
    [pendingHints, targetLabels],
  );

  /* Look for unseen hints on every route, after the route had a moment to
   * paint, and keep looking for a while: a page such as the catalog renders
   * its controls only once its data arrives. The tour shows the hints that
   * are on screen; the rest stay unseen until a page renders them, so a
   * catalog hint waits for the first visit to the catalog. */
  const isRunning = steps.length > 0;
  useEffect(() => {
    if (
      isAnchorView ||
      isBeacons ||
      isRunning ||
      status !== UserConfigStatus.Ready ||
      pendingSteps.length === 0
    ) {
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
  }, [isAnchorView, isBeacons, isRunning, status, pendingSteps, pathname]);

  const handleFinish = useCallback(
    (shownIds: string[]) => {
      setSeenIds([
        ...seenIds.filter((id) => !shownIds.includes(id)),
        ...shownIds,
      ]);
      setSteps(NO_STEPS);
    },
    [seenIds, setSeenIds],
  );

  const handleDismiss = useCallback(
    (id: string) => setSeenIds([...seenIds.filter((seen) => seen !== id), id]),
    [seenIds, setSeenIds],
  );

  const handleCloseAnchorView = useCallback(
    () =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete(ONBOARDING_ANCHORS_PARAM);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  if (isAnchorView) {
    return (
      <OnboardingAnchorMap
        anchors={anchors}
        onClose={handleCloseAnchorView}
        dir={i18n.dir()}
        labels={anchorMapLabels}
      />
    );
  }

  if (isBeacons) {
    /* Beacons need no start delay: the lib looks each target up again as
     * the page changes, so a catalog hint gets its beacon on the catalog. */
    return (
      <OnboardingBeacons
        hints={status === UserConfigStatus.Ready ? pendingSteps : NO_STEPS}
        onDismiss={handleDismiss}
        dir={i18n.dir()}
        labels={beaconLabels}
      />
    );
  }

  return (
    <OnboardingTour
      steps={steps}
      onFinish={handleFinish}
      isMobile={isMobile}
      dir={i18n.dir()}
      labels={labels}
    />
  );
};

export default memo(OnboardingHints);
