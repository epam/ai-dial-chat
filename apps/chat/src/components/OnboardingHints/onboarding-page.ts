import { OnboardingHintPage } from '@epam/ai-dial-chat-api-client';
import { ROUTES } from '../../types/routes';

/* Each page with the route prefixes it covers; a prefix matches the route
 * itself and everything below it. */
const PAGE_ROUTES: [OnboardingHintPage, string[]][] = [
  [OnboardingHintPage.Home, [ROUTES.Conversations]],
  [OnboardingHintPage.Projects, [ROUTES.Projects]],
  [OnboardingHintPage.ScheduledTasks, [ROUTES.ScheduledTasks]],
  [OnboardingHintPage.Catalog, [ROUTES.Catalog]],
  [OnboardingHintPage.FileManager, [ROUTES.FileManager]],
  [OnboardingHintPage.Settings, [ROUTES.Settings]],
  [OnboardingHintPage.Usage, [ROUTES.Usage]],
  [
    OnboardingHintPage.Editors,
    [
      ROUTES.AppsEditor,
      ROUTES.ToolsetEditor,
      ROUTES.CustomAppEditor,
      ROUTES.PromptEditor,
      ROUTES.SkillEditor,
    ],
  ],
];

const isUnder = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Maps a pathname to the onboarding page it belongs to, or `null` for a route no hint can name (login, the toolset sign-in). */
export const getOnboardingPage = (
  pathname: string,
): OnboardingHintPage | null => {
  if (pathname === ROUTES.Root) {
    return OnboardingHintPage.Home;
  }
  const match = PAGE_ROUTES.find(([, prefixes]) =>
    prefixes.some((prefix) => isUnder(pathname, prefix)),
  );
  return match?.[0] ?? null;
};

/** Whether a hint with `pages` belongs to `page`; a hint without pages belongs to the home page only. */
export const isHintOnOnboardingPage = (
  pages: readonly OnboardingHintPage[],
  page: OnboardingHintPage | null,
): boolean =>
  page != null &&
  (pages.length > 0 ? pages : [OnboardingHintPage.Home]).includes(page);
