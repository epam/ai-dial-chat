import type { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import { useIsMobile } from '@epam/ai-dial-chat-shared';
import {
  OnboardingHints as OnboardingHintsView,
  type OnboardingHint,
  type OnboardingHintsLabels,
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
  AuthI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ChatI18nKeys,
  ConversationPanelI18nKeys,
  DeploymentSelectorI18nKeys,
  EditorI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  OnboardingTourI18nKeys,
  ProjectsI18nKeys,
  ScheduledTasksI18nKeys,
  SettingsI18nKeys,
  SidebarI18nKeys,
  TextRefinementI18nKeys,
  ToolsI18nKeys,
  VoiceRecordingI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { StorageKey } from '../../types/storage-key';
import { UserConfigStatus } from '../../types/user-config-status';
import { getOnboardingPage, isHintOnOnboardingPage } from './onboarding-page';
import {
  getOnboardingAnchorTargets,
  resolveOnboardingTarget,
  type OnboardingTargetLabels,
} from './onboarding-targets';

/* The app shell's main landmark, which most anchors are looked up inside. */
const MAIN_CONTENT_ID = 'main-content';

/* `?onboarding-anchors` in the URL outlines every anchor on the page instead
 * of showing hints, so an operator can see what a hint's target points at.
 * The view then stays on while the app is open, so following links that drop
 * the parameter keeps it, until its panel is closed; a reload without the
 * parameter leaves it. */
export const ONBOARDING_ANCHORS_PARAM = 'onboarding-anchors';

/**
 * First-visit onboarding: feeds the operator-configured `onboardingHints`
 * of the current page (`onboarding-page.ts`) whose element is on screen to
 * the `OnboardingTour` lib. Each hint passed
 * with Next, and finishing or skipping the tour, stores the seen ids in
 * `localStorage`, so a hint is seen once per browser and a new id is shown
 * on the next visit. Hints whose element is not on screen wait for a page
 * that renders it.
 */
const OnboardingHints: FC = () => {
  const { t, i18n } = useTranslation();
  const { status, config } = useAppConfig();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAnchorsParam = searchParams.has(ONBOARDING_ANCHORS_PARAM);
  const [isKeptAnchorView, setIsKeptAnchorView] = useState(hasAnchorsParam);
  useEffect(() => {
    if (hasAnchorsParam) {
      setIsKeptAnchorView(true);
    }
  }, [hasAnchorsParam]);
  const isAnchorView = hasAnchorsParam || isKeptAnchorView;
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
    catalogBrowseSettings: t(CatalogI18nKeys.BrowseSettingsTitle),
    addToFavorites: t(FavoritesI18nKeys.AddToFavorites),
    removeFromFavorites: t(FavoritesI18nKeys.RemoveFromFavorites),
    messageActions: t(ButtonsI18nKeys.MessageActionsGroup),
    catalogDetails: t(CatalogI18nKeys.DetailsAriaLabel),
    useInChat: t(ButtonsI18nKeys.UseInChat),
    manage: t(ButtonsI18nKeys.Manage),
    logIn: t(ButtonsI18nKeys.LogIn),
    logOut: t(ButtonsI18nKeys.LogOut),
    loggingIn: t(ScheduledTasksI18nKeys.OfflineCredentialsBannerLoggingInLabel),
    manageCredentials: t(CatalogI18nKeys.CredentialsManageLabel),
    share: t(ButtonsI18nKeys.Share),
    publish: t(ButtonsI18nKeys.Publish),
    unpublish: t(ButtonsI18nKeys.Unpublish),
    create: t(ButtonsI18nKeys.Create),
    save: t(ButtonsI18nKeys.Save),
    edit: t(ButtonsI18nKeys.Edit),
    moreActions: t(ButtonsI18nKeys.MoreActions),
    pin: t(ButtonsI18nKeys.Pin),
    unpin: t(ButtonsI18nKeys.Unpin),
    sort: t(ButtonsI18nKeys.Sort),
    projectContext: t(ProjectsI18nKeys.CreateContextLabel),
    projectContextSearch: t(ProjectsI18nKeys.ViewContextSearchAriaLabel),
    /* The button reads "Back to <project>"; keep the part before the name. */
    projectChatBack: t(ProjectsI18nKeys.ChatBackToProject, {
      name: '\u0000',
    })
      .split('\u0000')[0]
      .trim(),
    scheduledTaskConfiguration: t(
      ScheduledTasksI18nKeys.CreateConfigurationSectionTitle,
    ),
    scheduledTaskDetails: t(ScheduledTasksI18nKeys.CreateDetailsSectionTitle),
    scheduledTaskSkills: t(ScheduledTasksI18nKeys.CreateSkillLabel),
    scheduledTaskInstructions: t(
      ScheduledTasksI18nKeys.CreateInstructionsLabel,
    ),
    scheduledTaskRefine: [
      t(TextRefinementI18nKeys.Action),
      t(TextRefinementI18nKeys.Refining),
      t(ButtonsI18nKeys.Regenerate),
    ],
    scheduledTaskTimezone: t(ScheduledTasksI18nKeys.CreateTimezoneChangeLabel),
    scheduledTaskStartDate: t(ScheduledTasksI18nKeys.CreateStartDateLabel),
    scheduledTaskRepeat: t(ScheduledTasksI18nKeys.CreateRepeatLabel),
    scheduledTaskModel: t(ScheduledTasksI18nKeys.CreateModelOrAgentLabel),
    scheduledTaskStartNow: t(ScheduledTasksI18nKeys.DetailStartNow),
    scheduledTaskStarting: t(ScheduledTasksI18nKeys.DetailStarting),
    scheduledTaskHistory: t(ScheduledTasksI18nKeys.DetailHistoryTitle),
    scheduledTaskActive: t(ScheduledTasksI18nKeys.DetailActiveStatusLabel),
    extensions: t(SettingsI18nKeys.Extensions),
    theme: t(SettingsI18nKeys.Theme),
    language: t(SettingsI18nKeys.Language),
    duplicateReadOnly: t(
      ConversationPanelI18nKeys.DuplicateReadOnlyDescription,
    ),
    sourcesPanel: t(SidebarI18nKeys.AriaLabel),
    downloadAll: t(SidebarI18nKeys.DownloadAll),
    /* The chip reads "Tools: <n> of <total> on"; keep the part before the count. */
    toolsSummary: t(ToolsI18nKeys.Summary, {
      selected: '\u0000',
      total: '\u0000',
    }).split('\u0000')[0],
    editorSetup: t(EditorI18nKeys.SetupSectionTitle),
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
    projectOutputs: t(ProjectsI18nKeys.OutputsTitle),
    projectChatList: t(ProjectsI18nKeys.ChatsTitle),
    projectDetails: t(ProjectsI18nKeys.ViewDetails),
    scheduledTasksCreate: t(ScheduledTasksI18nKeys.CreateButtonLabel),
    scheduledTasksSearch: t(ScheduledTasksI18nKeys.SearchAriaLabel),
    settings: t(BasicI18nKeys.Settings),
  } satisfies OnboardingTargetLabels);
  const targetLabels = useMemo(
    () => JSON.parse(targetLabelsKey) as OnboardingTargetLabels,
    [targetLabelsKey],
  );

  const labels = useMemo<OnboardingHintsLabels>(
    () => ({
      tour: {
        stepCounter: (current, total) =>
          t(OnboardingTourI18nKeys.StepCounter, { current, total }),
        next: t(OnboardingTourI18nKeys.Next),
        back: t(OnboardingTourI18nKeys.Back),
        done: t(OnboardingTourI18nKeys.Done),
        skip: t(OnboardingTourI18nKeys.Skip),
        close: t(OnboardingTourI18nKeys.Close),
      },
      anchorMap: {
        summary: (found, total) =>
          t(OnboardingTourI18nKeys.AnchorsSummary, { found, total }),
        missingHeading: t(OnboardingTourI18nKeys.AnchorsMissing),
        noneMissing: t(OnboardingTourI18nKeys.AnchorsNoneMissing),
        close: t(OnboardingTourI18nKeys.AnchorsClose),
      },
    }),
    [t],
  );

  /* Hint targets come from chat-api's closed list, so the cast only narrows
   * the lib's plain string back to the enum the resolvers are keyed by. */
  const resolveTarget = useCallback(
    (target: string) =>
      resolveOnboardingTarget(
        target as OnboardingHintTarget,
        targetLabels,
        MAIN_CONTENT_ID,
      ),
    [targetLabels],
  );
  const anchorTargets = useMemo(() => getOnboardingAnchorTargets(), []);

  /* A hint belongs to the pages it names, or to the home page when it names
   * none; a client-config from an older chat-api has no `pages` at all. */
  const page = getOnboardingPage(pathname);
  const pagesById = useMemo(
    () =>
      new Map(config.onboardingHints.map(({ id, pages }) => [id, pages ?? []])),
    [config.onboardingHints],
  );
  const isHintOnPage = useCallback(
    (hint: OnboardingHint) =>
      isHintOnOnboardingPage(pagesById.get(hint.id) ?? [], page),
    [pagesById, page],
  );

  const handleCloseAnchorView = useCallback(() => {
    setIsKeptAnchorView(false);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(ONBOARDING_ANCHORS_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  /* Hints wait on every route, so the pathname restarts the lookup. */
  return (
    <OnboardingHintsView
      hints={config.onboardingHints}
      resolveTarget={resolveTarget}
      anchorTargets={anchorTargets}
      seenIds={seenIds}
      onSeenIdsChange={setSeenIds}
      isEnabled={status === UserConfigStatus.Ready}
      pageKey={pathname}
      isHintOnPage={isHintOnPage}
      isAnchorView={isAnchorView}
      onCloseAnchorView={handleCloseAnchorView}
      isMobile={isMobile}
      dir={i18n.dir()}
      labels={labels}
    />
  );
};

export default memo(OnboardingHints);
