import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';

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

/* An element counts only when it has a box and sits outside an inert subtree,
 * so a closed mobile drawer or a `display: none` desktop control is skipped. */
const isOnScreen = (element: Element): element is HTMLElement =>
  element instanceof HTMLElement &&
  element.getClientRects().length > 0 &&
  element.closest('[inert]') == null &&
  getComputedStyle(element).visibility !== 'hidden';

const firstOnScreen = (elements: Iterable<Element>): HTMLElement | null => {
  for (const element of elements) {
    if (isOnScreen(element)) {
      return element;
    }
  }
  return null;
};

/* The name assistive technology reads: aria-labelledby, then aria-label, then
 * the visible text. */
const accessibleName = (element: Element): string => {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  }
  return (
    element.getAttribute('aria-label') ??
    element.textContent ??
    ''
  ).trim();
};

const queryAll = (
  scopes: Iterable<ParentNode>,
  selector: string,
): Element[] => {
  const found: Element[] = [];
  for (const scope of scopes) {
    found.push(...Array.from(scope.querySelectorAll(selector)));
  }
  return found;
};

const CONTROL_SELECTOR = 'button, a[href], [role="button"]';

/* A link or button inside `scopes` whose accessible name passes `matches`.
 * Names are compared as strings rather than built into a selector, so a
 * translated label never needs CSS escaping. */
const findControlBy = (
  scopes: Iterable<ParentNode>,
  matches: (name: string) => boolean,
): HTMLElement | null =>
  firstOnScreen(
    queryAll(scopes, CONTROL_SELECTOR).filter((element) =>
      matches(accessibleName(element)),
    ),
  );

const findControl = (
  scopes: Iterable<ParentNode>,
  name: string,
): HTMLElement | null =>
  findControlBy(scopes, (candidate) => candidate === name);

const named = (
  scopes: Iterable<ParentNode>,
  selector: string,
  name: string,
): Element[] =>
  queryAll(scopes, selector).filter(
    (element) => accessibleName(element) === name,
  );

const firstNamed = (
  scopes: Iterable<ParentNode>,
  selector: string,
  name: string,
): HTMLElement | null => firstOnScreen(named(scopes, selector, name));

/* A search field named `name`: its `role="search"` wrapper when it has one,
 * otherwise the input itself. */
const findSearch = (
  scopes: Iterable<ParentNode>,
  name: string,
): HTMLElement | null => {
  const input = firstNamed(scopes, 'input', name);
  return input
    ? (input.closest<HTMLElement>('search, [role="search"]') ?? input)
    : null;
};

const navigations = (labels: OnboardingTargetLabels): Element[] =>
  named([document], 'nav[aria-label]', labels.navigation);

const mainContent = (): Element[] => {
  const main = document.getElementById('main-content');
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
  return [field.closest('[role="region"], section, form') ?? mainContent()[0]];
};

const chatsSections = (labels: OnboardingTargetLabels): Element[] =>
  named(navigations(labels), 'section', labels.chats);

type AnchorResolver = (labels: OnboardingTargetLabels) => HTMLElement | null;

/* One resolver per target. Keyed by the generated enum, so a target added to
 * chat-api without a resolver here fails the build. The operator-facing
 * description of each anchor lives in onboarding-anchors.json and is rendered
 * into docs/onboarding-anchors.md. */
const ANCHOR_RESOLVERS: Record<OnboardingHintTarget, AnchorResolver> = {
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
  [OnboardingHintTarget.ConversationInput]: () =>
    firstOnScreen(queryAll(mainContent(), 'textarea')),
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
    firstNamed(mainContent(), '[role="log"]', labels.conversationMessages),
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
};

/** Every target the app can resolve. */
export const ONBOARDING_ANCHOR_TARGETS = Object.keys(
  ANCHOR_RESOLVERS,
) as OnboardingHintTarget[];

/**
 * Finds the on-screen element an onboarding hint points at, or `null` when it
 * is not rendered. Resolution goes through roles and accessible names — the
 * same contract the UI already exposes to assistive technology — so the libs
 * that render these elements need no onboarding-specific hooks or attributes.
 */
export const resolveOnboardingTarget = (
  target: OnboardingHintTarget,
  labels: OnboardingTargetLabels,
): HTMLElement | null => ANCHOR_RESOLVERS[target]?.(labels) ?? null;
