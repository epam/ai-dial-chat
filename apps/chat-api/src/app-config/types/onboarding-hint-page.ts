/**
 * The pages an operator-authored onboarding hint can be limited to.
 *
 * A closed list, like `OnboardingHintTarget`: config names a page and the
 * chat app maps its own routes onto these names, so config never carries a
 * raw path.
 */
export enum OnboardingHintPage {
  /** The new-chat screen and every conversation (`/`, `/conversations/…`). */
  Home = 'home',
  /** The Projects list, a project's view, chat, create and edit pages. */
  Projects = 'projects',
  /** The Scheduled tasks list and a task's detail, create and edit pages. */
  ScheduledTasks = 'scheduled-tasks',
  /** The catalog, with its item details. */
  Catalog = 'catalog',
  /** The file manager. */
  FileManager = 'file-manager',
  /** Every Settings tab. */
  Settings = 'settings',
  /** The Usage page. */
  Usage = 'usage',
  /** The app, toolset, custom-app, prompt and skill editors. */
  Editors = 'editors',
}
