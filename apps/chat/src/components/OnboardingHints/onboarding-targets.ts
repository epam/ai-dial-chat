import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import {
  accessibleName,
  findControl,
  findControlBy,
  findSearch,
  firstNamed,
  findControlNear,
  firstOnScreen,
  lastOnScreen,
  named,
  queryAll,
} from '@epam/ai-dial-onboarding-tour';

/** Accessible names the resolvers match against; the caller passes them translated. */
export interface OnboardingTargetLabels {
  /** The New chat link or button. */
  newChat: string;
  /** The navigation landmark. */
  navigation: string;
  /** The Projects navigation link. */
  projects: string;
  /** The Scheduled tasks navigation link. */
  scheduledTasks: string;
  /** The Catalog navigation link; also names the catalog page's region. */
  catalog: string;
  /** The File manager navigation link. */
  fileManager: string;
  /** The composer's "+" trigger. */
  addAttachment: string;
  /** The catalog's "Create" button. */
  catalogCreate: string;
  /** The catalog's grid/list view switch. */
  catalogViewMode: string;
  /** The catalog filter's label while nothing is filtered ("From"). */
  catalogFilterFrom: string;
  /** The catalog filter's label while only the user's own items are shown ("My"). */
  catalogFilterMy: string;
  /** The catalog's sort options; the sort trigger is named after the applied one. */
  catalogSortOptions: string[];
  /** The phone-only button that opens the catalog's view, sort and filter sheet. */
  catalogBrowseSettings: string;
  /** A catalog card's star while the item is not a favorite. */
  addToFavorites: string;
  /** A catalog card's star while the item is a favorite. */
  removeFromFavorites: string;
  /** The action bar under a message. */
  messageActions: string;
  /** The catalog item details drawer. */
  catalogDetails: string;
  /** The details drawer's "Use in chat" button. */
  useInChat: string;
  /** The "Manage" menu button. */
  manage: string;
  /** A "Log in" button. */
  logIn: string;
  /** A "Log out" button. */
  logOut: string;
  /** The "Logging in…" state of a "Log in" button. */
  loggingIn: string;
  /** The toolset "Manage credentials" button. */
  manageCredentials: string;
  /** A "Share" button. */
  share: string;
  /** A "Publish" button. */
  publish: string;
  /** An "Unpublish" button. */
  unpublish: string;
  /** A form's "Create" button. */
  create: string;
  /** A form's "Save" button. */
  save: string;
  /** An "Edit" button. */
  edit: string;
  /** A "More actions" menu button. */
  moreActions: string;
  /** A "Pin" button. */
  pin: string;
  /** An "Unpin" button. */
  unpin: string;
  /** A "Sort" group. */
  sort: string;
  /** The project form's "Context" section. */
  projectContext: string;
  /** The project details panel's context-file search field. */
  projectContextSearch: string;
  /** The fixed start of a project chat's "Back to <project>" button. */
  projectChatBack: string;
  /** The scheduled task form's "Configuration" section. */
  scheduledTaskConfiguration: string;
  /** The scheduled task form's "Repeat" picker. */
  scheduledTaskRepeat: string;
  /** The fixed start of the scheduled task form's model or agent picker name. */
  scheduledTaskModel: string;
  /** A scheduled task's "Start now" button. */
  scheduledTaskStartNow: string;
  /** The "Starting…" state of that button. */
  scheduledTaskStarting: string;
  /** A scheduled task's run history list. */
  scheduledTaskHistory: string;
  /** A scheduled task's "Active" switch. */
  scheduledTaskActive: string;
  /** The Scheduled tasks page's sort options; its sort trigger is named after the applied one. */
  scheduledTasksSortOptions: string[];
  /** The settings page's extensions table. */
  extensions: string;
  /** The settings page's theme picker. */
  theme: string;
  /** The settings page's language picker. */
  language: string;
  /** A read-only chat's duplicate button. */
  duplicateReadOnly: string;
  /** The conversation sources panel. */
  sourcesPanel: string;
  /** The sources panel's "Download all" button. */
  downloadAll: string;
  /** The fixed start of the composer's tools chip name. */
  toolsSummary: string;
  /** An editor's "Setup" section. */
  editorSetup: string;
  /** The composer's send button. */
  sendMessage: string;
  /** The model selector; its name is this label, or this label followed by ": " and the model. */
  modelSelector: string;
  /** The composer's dictation button. */
  voiceInput: string;
  /** The list of starter prompts on the new-chat screen. */
  conversationStarters: string;
  /** The message log of an open conversation. */
  conversationMessages: string;
  /** The button that opens the sources panel. */
  sourcesPanelToggle: string;
  /** The desktop sidebar collapse/expand button. */
  sidebarToggle: string;
  /** The mobile header button that opens the navigation drawer. */
  mobileMenu: string;
  /** The sidebar's chats section. */
  chats: string;
  /** The chats section's search button. */
  chatsSearch: string;
  /** The chats section's filter button. */
  chatsFilter: string;
  /** The text every user-menu trigger contains: "Signed in as" without the email. */
  signedInAs: string;
  /** The Usage link in the sidebar. */
  usage: string;
  /** The Projects page's "New project" button. */
  projectsCreate: string;
  /** The Projects page's search field. */
  projectsSearch: string;
  /** The project view's chats section. */
  projectChats: string;
  /** The project view's details panel. */
  projectDetails: string;
  /** The Scheduled tasks page's "New task" button. */
  scheduledTasksCreate: string;
  /** The Scheduled tasks page's search field. */
  scheduledTasksSearch: string;
  /** The settings page's section tabs. */
  settings: string;
}

const isOneOf =
  (...names: string[]) =>
  (name: string): boolean =>
    names.includes(name);

/* An empty prefix (a template that starts with its value) must match nothing. */
const startsWithNonEmpty =
  (prefix: string) =>
  (name: string): boolean =>
    prefix !== '' && name.startsWith(prefix);

type AnchorResolver = (labels: OnboardingTargetLabels) => HTMLElement | null;

/* One resolver per target, built per page-content id. Keyed by the generated
 * enum, so a target added to chat-api without a resolver here fails the
 * build. Built on demand rather than at import, so a test that mocks the API
 * client without the enum can still import this module. */
const buildResolvers = (
  mainContentId: string,
): Record<OnboardingHintTarget, AnchorResolver> => {
  const navigations = (labels: OnboardingTargetLabels): Element[] =>
    named([document], 'nav[aria-label]', labels.navigation);

  const mainContent = (): Element[] => {
    const main = document.getElementById(mainContentId);
    return main ? [main] : [];
  };

  /* The catalog page: a region named like its navigation link. */
  const catalogRegions = (labels: OnboardingTargetLabels): Element[] =>
    named(mainContent(), 'section[aria-label]', labels.catalog);

  const firstInCatalog = (
    labels: OnboardingTargetLabels,
    selector: string,
    matches: (element: Element) => boolean = () => true,
  ): HTMLElement | null =>
    firstOnScreen(
      catalogRegions(labels).flatMap((region) =>
        Array.from(region.querySelectorAll(selector)).filter(matches),
      ),
    );

  /* The composer's surroundings: the region or section around an on-screen
   * composer text field. Empty on a page with no composer, so a page-level
   * "Add" button (the file manager's) never passes for the composer's "+". */
  const composerScopes = (): Element[] => {
    const field = firstOnScreen(queryAll(mainContent(), 'textarea'));
    if (!field) {
      return [];
    }
    return [
      field.closest('[role="region"], section, form') ?? mainContent()[0],
    ];
  };

  const conversationLogs = (labels: OnboardingTargetLabels): Element[] =>
    named(mainContent(), '[role="log"]', labels.conversationMessages);

  /* The whole composer: the smallest element holding both the text field and
   * the Send button, so a hint card sits outside the composer rather than over
   * its toolbar. Falls back to the text field when no Send button is found. */
  const findComposer = (labels: OnboardingTargetLabels): HTMLElement | null => {
    const field = firstOnScreen(queryAll(mainContent(), 'textarea'));
    const send = field
      ? findControl(composerScopes(), labels.sendMessage)
      : null;
    if (!field || !send) {
      return field;
    }
    let element: HTMLElement | null = field;
    while (element && !element.contains(send)) {
      element = element.parentElement;
    }
    return element ?? field;
  };

  const catalogDetailsDialogs = (labels: OnboardingTargetLabels): Element[] =>
    named([document], '[role="dialog"]', labels.catalogDetails);

  const projectDetailsPanel = (
    labels: OnboardingTargetLabels,
  ): HTMLElement | null =>
    firstNamed(mainContent(), 'aside', labels.projectDetails);

  const scheduledTaskHistoryList = (
    labels: OnboardingTargetLabels,
  ): HTMLElement | null =>
    firstNamed(
      mainContent(),
      'ul[aria-label], [role="list"]',
      labels.scheduledTaskHistory,
    );

  const extensionsTables = (labels: OnboardingTargetLabels): Element[] =>
    named(mainContent(), 'table, [role="table"]', labels.extensions);

  const sourcesPanels = (labels: OnboardingTargetLabels): Element[] =>
    named([document], 'aside', labels.sourcesPanel);

  const chatsSections = (labels: OnboardingTargetLabels): Element[] =>
    named(navigations(labels), 'section', labels.chats);

  return {
    /* Anywhere: a sidebar link on desktop, a header button on mobile. */
    [OnboardingHintTarget.NewChat]: (labels) =>
      findControl([document], labels.newChat),
    [OnboardingHintTarget.Navigation]: (labels) =>
      firstOnScreen(navigations(labels)),
    [OnboardingHintTarget.Projects]: (labels) =>
      findControl(navigations(labels), labels.projects),
    [OnboardingHintTarget.ScheduledTasks]: (labels) =>
      findControl(navigations(labels), labels.scheduledTasks),
    [OnboardingHintTarget.Catalog]: (labels) =>
      findControl(navigations(labels), labels.catalog),
    [OnboardingHintTarget.FileManager]: (labels) =>
      findControl(navigations(labels), labels.fileManager),
    [OnboardingHintTarget.ConversationInput]: (labels) => findComposer(labels),
    [OnboardingHintTarget.AddAttachment]: (labels) =>
      findControl(composerScopes(), labels.addAttachment),
    [OnboardingHintTarget.SendMessage]: (labels) =>
      findControl(composerScopes(), labels.sendMessage),
    /* Named "Select model" until a model is chosen, then "Select model: <name>". */
    [OnboardingHintTarget.ModelSelector]: (labels) =>
      findControlBy(
        mainContent(),
        (name) =>
          name === labels.modelSelector ||
          name.startsWith(`${labels.modelSelector}: `),
      ),
    [OnboardingHintTarget.VoiceInput]: (labels) =>
      findControl(composerScopes(), labels.voiceInput),
    [OnboardingHintTarget.ConversationStarters]: (labels) =>
      firstNamed(mainContent(), '[role="list"]', labels.conversationStarters),
    [OnboardingHintTarget.ConversationMessages]: (labels) =>
      firstOnScreen(conversationLogs(labels)),
    /* Every finished message has an action bar; the last one belongs to the
     * newest message, normally the latest answer. */
    [OnboardingHintTarget.MessageActions]: (labels) =>
      lastOnScreen(
        named(
          conversationLogs(labels),
          '[role="toolbar"]',
          labels.messageActions,
        ),
      ),
    [OnboardingHintTarget.SourcesPanelToggle]: (labels) =>
      findControl(mainContent(), labels.sourcesPanelToggle),
    /* The desktop collapse button in the sidebar, or the mobile header button
     * that opens the drawer. */
    [OnboardingHintTarget.SidebarToggle]: (labels) =>
      findControl(navigations(labels), labels.sidebarToggle) ??
      findControl(mainContent(), labels.mobileMenu),
    [OnboardingHintTarget.Chats]: (labels) =>
      firstOnScreen(chatsSections(labels)),
    /* The search button while search is closed, the search field once open. */
    [OnboardingHintTarget.ChatsSearch]: (labels) =>
      findControl(chatsSections(labels), labels.chatsSearch) ??
      firstOnScreen(queryAll(chatsSections(labels), 'search, [role="search"]')),
    [OnboardingHintTarget.ChatsFilter]: (labels) =>
      findControl(chatsSections(labels), labels.chatsFilter),
    /* The trigger's name carries the user's email (and, in the profile layout,
     * the display name), so it is matched on the fixed part. */
    [OnboardingHintTarget.UserMenu]: (labels) =>
      labels.signedInAs
        ? findControlBy(navigations(labels), (name) =>
            name.includes(labels.signedInAs),
          )
        : null,
    [OnboardingHintTarget.Usage]: (labels) =>
      findControl(navigations(labels), labels.usage),
    [OnboardingHintTarget.ProjectsCreate]: (labels) =>
      findControl(mainContent(), labels.projectsCreate),
    [OnboardingHintTarget.ProjectsSearch]: (labels) =>
      findSearch(mainContent(), labels.projectsSearch),
    [OnboardingHintTarget.ProjectChats]: (labels) =>
      firstNamed(mainContent(), 'section', labels.projectChats),
    [OnboardingHintTarget.ProjectDetails]: (labels) =>
      firstNamed(mainContent(), 'aside', labels.projectDetails),
    [OnboardingHintTarget.ScheduledTasksCreate]: (labels) =>
      findControl(mainContent(), labels.scheduledTasksCreate),
    [OnboardingHintTarget.ScheduledTasksSearch]: (labels) =>
      findSearch(mainContent(), labels.scheduledTasksSearch),
    [OnboardingHintTarget.SettingsSections]: (labels) =>
      firstNamed(mainContent(), '[role="tablist"]', labels.settings),
    [OnboardingHintTarget.CatalogCreate]: (labels) =>
      findControl(catalogRegions(labels), labels.catalogCreate),
    [OnboardingHintTarget.CatalogSearch]: (labels) =>
      firstInCatalog(labels, 'search, [role="search"]'),
    [OnboardingHintTarget.CatalogTabs]: (labels) =>
      firstInCatalog(labels, '[role="tablist"]'),
    [OnboardingHintTarget.CatalogViewMode]: (labels) =>
      firstInCatalog(
        labels,
        '[role="radiogroup"]',
        (element) =>
          element.getAttribute('aria-label') === labels.catalogViewMode,
      ),
    /* The trigger is named after the applied filter: "From", "From: 2 of 5",
     * "My" or "My · 2". */
    [OnboardingHintTarget.CatalogFilter]: (labels) =>
      findControlBy(
        catalogRegions(labels),
        (name) =>
          name === labels.catalogFilterFrom ||
          name.startsWith(`${labels.catalogFilterFrom}: `) ||
          name === labels.catalogFilterMy ||
          name.startsWith(`${labels.catalogFilterMy} · `),
      ),
    /* The trigger is named after the applied order; on a phone, sorting lives
     * in the browse-settings sheet. */
    [OnboardingHintTarget.CatalogSort]: (labels) =>
      findControlBy(catalogRegions(labels), (name) =>
        labels.catalogSortOptions.includes(name),
      ) ?? findControl(catalogRegions(labels), labels.catalogBrowseSettings),
    /* Each card is an `article` named after its item, the favorites strip's
     * first. */
    [OnboardingHintTarget.CatalogCard]: (labels) =>
      firstInCatalog(labels, 'article[aria-label]'),
    [OnboardingHintTarget.CatalogDetails]: (labels) =>
      firstOnScreen(catalogDetailsDialogs(labels)),
    [OnboardingHintTarget.CatalogDetailsUseInChat]: (labels) =>
      findControl(catalogDetailsDialogs(labels), labels.useInChat),
    [OnboardingHintTarget.CatalogDetailsManage]: (labels) =>
      findControl(catalogDetailsDialogs(labels), labels.manage),
    /* Named after the sign-in state. */
    [OnboardingHintTarget.CatalogDetailsCredentials]: (labels) =>
      findControlBy(
        catalogDetailsDialogs(labels),
        isOneOf(labels.logIn, labels.logOut, labels.manageCredentials),
      ),
    [OnboardingHintTarget.CatalogDetailsShare]: (labels) =>
      findControl(catalogDetailsDialogs(labels), labels.share),
    [OnboardingHintTarget.CatalogDetailsPublish]: (labels) =>
      findControlBy(
        catalogDetailsDialogs(labels),
        isOneOf(labels.publish, labels.unpublish),
      ),
    [OnboardingHintTarget.CatalogDetailsTabs]: (labels) =>
      firstOnScreen(
        queryAll(catalogDetailsDialogs(labels), '[role="tablist"]'),
      ),
    /* "Create" and "Save" are common names, so the button is looked for next
     * to the form's own "Context" section. Desktop and phone each render one
     * copy; the on-screen one wins. */
    [OnboardingHintTarget.ProjectFormSubmit]: (labels) =>
      findControlNear(
        firstNamed(mainContent(), 'section', labels.projectContext),
        isOneOf(labels.create, labels.save),
      ),
    [OnboardingHintTarget.ProjectFormContext]: (labels) =>
      firstNamed(mainContent(), 'section', labels.projectContext),
    /* The project view's header actions sit next to its details panel. */
    [OnboardingHintTarget.ProjectViewEdit]: (labels) =>
      findControlNear(projectDetailsPanel(labels), isOneOf(labels.edit)),
    [OnboardingHintTarget.ProjectViewMoreActions]: (labels) =>
      findControlNear(projectDetailsPanel(labels), isOneOf(labels.moreActions)),
    [OnboardingHintTarget.ProjectViewPin]: (labels) =>
      findControlNear(
        projectDetailsPanel(labels),
        isOneOf(labels.pin, labels.unpin),
      ),
    [OnboardingHintTarget.ProjectViewPublish]: (labels) =>
      findControlNear(
        projectDetailsPanel(labels),
        isOneOf(labels.publish, labels.unpublish),
      ),
    [OnboardingHintTarget.ProjectContextSearch]: (labels) => {
      const panel = projectDetailsPanel(labels);
      return panel ? findSearch([panel], labels.projectContextSearch) : null;
    },
    [OnboardingHintTarget.ProjectsSort]: (labels) =>
      firstNamed(mainContent(), '[role="group"]', labels.sort),
    [OnboardingHintTarget.ScheduledTaskFormSubmit]: (labels) =>
      findControlNear(
        firstNamed(
          mainContent(),
          '[role="group"]',
          labels.scheduledTaskConfiguration,
        ),
        isOneOf(labels.create, labels.save),
      ),
    [OnboardingHintTarget.ScheduledTaskConfiguration]: (labels) =>
      firstNamed(
        mainContent(),
        '[role="group"]',
        labels.scheduledTaskConfiguration,
      ),
    [OnboardingHintTarget.ScheduledTaskRepeat]: (labels) =>
      firstNamed(
        mainContent(),
        '[role="combobox"]',
        labels.scheduledTaskRepeat,
      ),
    /* The label also carries the "required" marker, so it is matched on its start. */
    [OnboardingHintTarget.ScheduledTaskModel]: (labels) =>
      firstOnScreen(
        queryAll(
          mainContent(),
          'button, [role="button"], [role="combobox"]',
        ).filter((element) =>
          startsWithNonEmpty(labels.scheduledTaskModel)(
            accessibleName(element),
          ),
        ),
      ),
    [OnboardingHintTarget.ScheduledTaskStartNow]: (labels) =>
      findControlBy(
        mainContent(),
        isOneOf(labels.scheduledTaskStartNow, labels.scheduledTaskStarting),
      ),
    /* "Edit" is a common name, so the button is looked for next to the run history. */
    [OnboardingHintTarget.ScheduledTaskEdit]: (labels) =>
      findControlNear(scheduledTaskHistoryList(labels), isOneOf(labels.edit)),
    [OnboardingHintTarget.ScheduledTaskHistory]: (labels) =>
      scheduledTaskHistoryList(labels),
    [OnboardingHintTarget.ScheduledTaskActive]: (labels) =>
      firstNamed(mainContent(), '[role="switch"]', labels.scheduledTaskActive),
    /* Named after the applied order, like the catalog's; looked for next to the
     * page's own search so the catalog's sort never passes for it. */
    [OnboardingHintTarget.ScheduledTasksSort]: (labels) =>
      findControlNear(
        findSearch(mainContent(), labels.scheduledTasksSearch),
        (name) => labels.scheduledTasksSortOptions.includes(name),
      ),
    [OnboardingHintTarget.SettingsExtensions]: (labels) =>
      firstOnScreen(extensionsTables(labels)),
    [OnboardingHintTarget.SettingsExtensionsLogIn]: (labels) =>
      findControlBy(
        extensionsTables(labels),
        isOneOf(labels.logIn, labels.loggingIn),
      ),
    [OnboardingHintTarget.SettingsTheme]: (labels) =>
      firstNamed(mainContent(), '[role="combobox"]', labels.theme),
    [OnboardingHintTarget.SettingsLanguage]: (labels) =>
      firstNamed(mainContent(), '[role="combobox"]', labels.language),
    [OnboardingHintTarget.DuplicateSharedChat]: (labels) =>
      findControl(mainContent(), labels.duplicateReadOnly),
    [OnboardingHintTarget.SourcesPanel]: (labels) =>
      firstOnScreen(sourcesPanels(labels)),
    [OnboardingHintTarget.SourcesDownloadAll]: (labels) =>
      findControl(sourcesPanels(labels), labels.downloadAll),
    /* The name carries the project's name, so it is matched on its start. */
    [OnboardingHintTarget.ProjectChatBack]: (labels) =>
      findControlBy(mainContent(), startsWithNonEmpty(labels.projectChatBack)),
    /* The name carries the selected count, so it is matched on its start. */
    [OnboardingHintTarget.ToolsSelector]: (labels) =>
      findControlBy(composerScopes(), startsWithNonEmpty(labels.toolsSummary)),
    /* The row the open conversation is marked current on; only one is. */
    [OnboardingHintTarget.ActiveChat]: (labels) =>
      firstOnScreen(queryAll(chatsSections(labels), '[aria-current="page"]')),
    /* Its menu button sits in the same list item; it is transparent until the
     * row is hovered or focused, but keeps its box. */
    [OnboardingHintTarget.ActiveChatActions]: (labels) => {
      const row = firstOnScreen(
        queryAll(chatsSections(labels), '[aria-current="page"]'),
      );
      const item = row?.closest('li');
      return item ? findControl([item], labels.moreActions) : null;
    },
    [OnboardingHintTarget.EditorSetup]: (labels) =>
      firstNamed(mainContent(), 'section', labels.editorSetup),
    [OnboardingHintTarget.CatalogFavorite]: (labels) =>
      findControlBy(
        catalogRegions(labels),
        (name) =>
          name === labels.addToFavorites || name === labels.removeFromFavorites,
      ),
  };
};

const resolverCache = new Map<
  string,
  Record<OnboardingHintTarget, AnchorResolver>
>();

const resolversFor = (
  mainContentId: string,
): Record<OnboardingHintTarget, AnchorResolver> => {
  let resolvers = resolverCache.get(mainContentId);
  if (!resolvers) {
    resolvers = buildResolvers(mainContentId);
    resolverCache.set(mainContentId, resolvers);
  }
  return resolvers;
};

/** Returns every onboarding target `resolveOnboardingTarget` can resolve. */
export const getOnboardingAnchorTargets = (): OnboardingHintTarget[] =>
  Object.keys(resolversFor('')) as OnboardingHintTarget[];

/**
 * Finds the on-screen element an onboarding hint points at, or `null` when it
 * is not rendered. Resolution goes through roles and translated accessible
 * names inside the host's landmarks, so the libs that render these elements
 * need no onboarding-specific attributes.
 */
export const resolveOnboardingTarget = (
  target: OnboardingHintTarget,
  labels: OnboardingTargetLabels,
  mainContentId: string,
): HTMLElement | null => resolversFor(mainContentId)[target]?.(labels) ?? null;
