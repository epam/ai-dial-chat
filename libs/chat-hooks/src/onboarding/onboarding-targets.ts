import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import {
  findControl,
  findControlBy,
  findSearch,
  firstNamed,
  firstOnScreen,
  lastOnScreen,
  named,
  queryAll,
} from './aria-lookup';

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
