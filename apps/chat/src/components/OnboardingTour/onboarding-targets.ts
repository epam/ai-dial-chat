import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';

/** Accessible names the resolvers match against; the caller passes them translated. */
export interface OnboardingTargetLabels {
  newChat: string;
  navigation: string;
  projects: string;
  scheduledTasks: string;
  catalog: string;
  fileManager: string;
  /** The composer's "+" trigger. */
  addAttachment: string;
  /** The catalog's "Create" button. */
  catalogCreate: string;
  /** The catalog's grid/list view switch. */
  catalogViewMode: string;
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

const accessibleName = (element: Element): string =>
  (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();

/* A control named `name` inside one of `scopes` — a link or a button, matched
 * by its aria-label or, failing that, its visible text. */
const findControl = (
  scopes: Iterable<ParentNode>,
  name: string,
): HTMLElement | null => {
  const controls: Element[] = [];
  for (const scope of scopes) {
    controls.push(
      ...Array.from(
        scope.querySelectorAll('button, a[href], [role="button"]'),
      ).filter((element) => accessibleName(element) === name),
    );
  }
  return firstOnScreen(controls);
};

/* Compared as a string rather than built into a selector, so a translated
 * label never needs CSS escaping. */
const navigations = (labels: OnboardingTargetLabels): Element[] =>
  Array.from(document.querySelectorAll('nav[aria-label]')).filter(
    (element) => element.getAttribute('aria-label') === labels.navigation,
  );

const mainContent = (): Element[] => {
  const main = document.getElementById('main-content');
  return main ? [main] : [];
};

/* The catalog page: a region named like its navigation link. */
const catalogRegions = (labels: OnboardingTargetLabels): Element[] =>
  mainContent().flatMap((main) =>
    Array.from(main.querySelectorAll('section[aria-label]')).filter(
      (element) => element.getAttribute('aria-label') === labels.catalog,
    ),
  );

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

/**
 * Finds the on-screen element an onboarding hint points at, or `null` when it
 * is not rendered. Resolution goes through roles and accessible names — the
 * same contract the UI already exposes to assistive technology — so the libs
 * that render these elements need no onboarding-specific hooks or attributes.
 */
export const resolveOnboardingTarget = (
  target: OnboardingHintTarget,
  labels: OnboardingTargetLabels,
): HTMLElement | null => {
  switch (target) {
    case OnboardingHintTarget.NewChat:
      /* Anywhere: a sidebar link on desktop, a header button on mobile. */
      return findControl([document], labels.newChat);
    case OnboardingHintTarget.Navigation:
      return firstOnScreen(navigations(labels));
    case OnboardingHintTarget.Projects:
      return findControl(navigations(labels), labels.projects);
    case OnboardingHintTarget.ScheduledTasks:
      return findControl(navigations(labels), labels.scheduledTasks);
    case OnboardingHintTarget.Catalog:
      return findControl(navigations(labels), labels.catalog);
    case OnboardingHintTarget.FileManager:
      return findControl(navigations(labels), labels.fileManager);
    case OnboardingHintTarget.ConversationInput:
      return firstOnScreen(document.querySelectorAll('#main-content textarea'));
    case OnboardingHintTarget.AddAttachment:
      return findControl(mainContent(), labels.addAttachment);
    case OnboardingHintTarget.CatalogCreate:
      return findControl(catalogRegions(labels), labels.catalogCreate);
    case OnboardingHintTarget.CatalogSearch:
      return firstInCatalog(labels, 'search, [role="search"]');
    case OnboardingHintTarget.CatalogTabs:
      return firstInCatalog(labels, '[role="tablist"]');
    case OnboardingHintTarget.CatalogViewMode:
      return firstInCatalog(
        labels,
        '[role="radiogroup"]',
        (element) =>
          element.getAttribute('aria-label') === labels.catalogViewMode,
      );
    default:
      return null;
  }
};
