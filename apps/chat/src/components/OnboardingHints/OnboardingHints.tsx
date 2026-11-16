import type { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import {
  getOnboardingAnchorTargets,
  resolveOnboardingTarget,
  useOnboardingHints,
  type OnboardingTargetLabels,
} from '@epam/ai-dial-chat-hooks/onboarding';
import { useIsMobile } from '@epam/ai-dial-chat-shared';
import {
  OnboardingAnchorMap,
  OnboardingTour,
  type OnboardingAnchor,
  type OnboardingAnchorMapLabels,
  type OnboardingTourLabels,
} from '@epam/ai-dial-onboarding-tour';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router';
import {
  AuthI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ChatI18nKeys,
  ConversationPanelI18nKeys,
  DeploymentSelectorI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  OnboardingTourI18nKeys,
  ProjectsI18nKeys,
  ScheduledTasksI18nKeys,
  SidebarI18nKeys,
  VoiceRecordingI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { StorageKey } from '../../types/storage-key';
import { UserConfigStatus } from '../../types/user-config-status';

/* The app shell's main landmark, which most anchors are looked up inside. */
const MAIN_CONTENT_ID = 'main-content';

/* `?onboarding-anchors` in the URL outlines every anchor on the page instead
 * of showing hints, so an operator can see what a hint's target points at. */
export const ONBOARDING_ANCHORS_PARAM = 'onboarding-anchors';

/**
 * First-visit onboarding: feeds the operator-configured `onboardingHints`
 * whose element is on screen to the `OnboardingTour` lib. Finishing or
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
    catalogFilterFrom: t(CatalogI18nKeys.BrowseSettingsFrom),
    catalogFilterMy: t(CatalogI18nKeys.BrowseSettingsMy),
    catalogSortOptions: [
      t(CatalogI18nKeys.SortRecentlyUpdated),
      t(CatalogI18nKeys.SortNewest),
      t(CatalogI18nKeys.SortNameAZ),
    ],
    catalogBrowseSettings: t(CatalogI18nKeys.BrowseSettingsTitle),
    addToFavorites: t(FavoritesI18nKeys.AddToFavorites),
    removeFromFavorites: t(FavoritesI18nKeys.RemoveFromFavorites),
    messageActions: t(ButtonsI18nKeys.MessageActionsGroup),
    sendMessage: t(ChatI18nKeys.SendMessage),
    modelSelector: t(DeploymentSelectorI18nKeys.AriaLabel),
    voiceInput: t(VoiceRecordingI18nKeys.MicLabel),
    conversationStarters: t(ChatI18nKeys.ConversationStarters),
    conversationMessages: t(ChatI18nKeys.ConversationMessages),
    sourcesPanelToggle: t(SidebarI18nKeys.ToggleOpen),
    sidebarToggle: t(NavigationI18nKeys.Sidebar),
    mobileMenu: t(NavigationI18nKeys.Menu),
    chats: t(ConversationPanelI18nKeys.ChatsAndTasks),
    chatsSearch: t(ConversationPanelI18nKeys.SearchOpen),
    chatsFilter: t(ConversationPanelI18nKeys.FilterGroupAriaLabel),
    /* The trigger reads "Signed in as <email>"; keep the fixed part. */
    signedInAs: t(AuthI18nKeys.SignedInAs, { email: '' }).trim(),
    usage: t(BasicI18nKeys.Usage),
    projectsCreate: t(ProjectsI18nKeys.PageNewProject),
    projectsSearch: t(ProjectsI18nKeys.SearchAriaLabel),
    projectChats: t(ProjectsI18nKeys.ViewMainContent),
    projectDetails: t(ProjectsI18nKeys.ViewDetails),
    scheduledTasksCreate: t(ScheduledTasksI18nKeys.CreateButtonLabel),
    scheduledTasksSearch: t(ScheduledTasksI18nKeys.SearchAriaLabel),
    settings: t(BasicI18nKeys.Settings),
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
  const resolveTarget = useCallback(
    (target: OnboardingHintTarget) =>
      resolveOnboardingTarget(target, targetLabels, MAIN_CONTENT_ID),
    [targetLabels],
  );
  const anchors = useMemo<OnboardingAnchor[]>(
    () =>
      getOnboardingAnchorTargets().map((target) => ({
        id: target,
        getTarget: () => resolveTarget(target),
      })),
    [resolveTarget],
  );

  /* Hints wait on every route, so the pathname restarts the lookup. */
  const { steps, onFinish } = useOnboardingHints({
    hints: config.onboardingHints,
    seenIds,
    onSeenIdsChange: setSeenIds,
    resolveTarget,
    isEnabled: !isAnchorView && status === UserConfigStatus.Ready,
    pageKey: pathname,
  });

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

  return (
    <OnboardingTour
      steps={steps}
      onFinish={onFinish}
      isMobile={isMobile}
      dir={i18n.dir()}
      labels={labels}
    />
  );
};

export default memo(OnboardingHints);
