import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveOnboardingTarget,
  type OnboardingTargetLabels,
} from '../onboarding-targets';

const labels: OnboardingTargetLabels = {
  newChat: 'New chat',
  navigation: 'Main navigation',
  projects: 'Projects',
  scheduledTasks: 'Scheduled tasks',
  catalog: 'Catalog',
  fileManager: 'File manager',
  addAttachment: 'Add',
  catalogCreate: 'Create',
  catalogViewMode: 'View mode',
  catalogFilterFrom: 'From',
  catalogFilterMy: 'My',
  catalogBrowseSettings: 'Browse settings',
  addToFavorites: 'Add to favorites',
  removeFromFavorites: 'Remove from favorites',
  messageActions: 'Message actions',
  catalogDetails: 'Item details',
  useInChat: 'Use in chat',
  manage: 'Manage',
  logIn: 'Log in',
  logOut: 'Log out',
  loggingIn: 'Logging in',
  manageCredentials: 'Manage credentials',
  share: 'Share',
  publish: 'Publish',
  unpublish: 'Unpublish',
  create: 'Create',
  save: 'Save',
  edit: 'Edit',
  moreActions: 'More actions',
  pin: 'Pin',
  unpin: 'Unpin',
  sort: 'Sort',
  projectContext: 'Context',
  projectContextSearch: 'Search context files',
  projectChatBack: 'Back to',
  scheduledTaskConfiguration: 'Configuration',
  scheduledTaskDetails: 'Details',
  scheduledTaskSkills: 'Skills',
  scheduledTaskInstructions: 'Instructions',
  scheduledTaskRefine: ['Refine with AI', 'Refining', 'Regenerate'],
  scheduledTaskTimezone: 'Change timezone',
  scheduledTaskStartDate: 'Start date',
  scheduledTaskRepeat: 'Repeat',
  scheduledTaskModel: 'Model or Agent',
  scheduledTaskStartNow: 'Start now',
  scheduledTaskStarting: 'Starting…',
  scheduledTaskHistory: 'History',
  scheduledTaskActive: 'Active',
  extensions: 'Extensions',
  theme: 'Theme',
  language: 'Language',
  duplicateReadOnly: 'Duplicate the conversation to be able to edit it',
  sourcesPanel: 'Conversation sources',
  downloadAll: 'Download all',
  toolsSummary: 'Tools: ',
  editorSetup: 'Setup',
  sendMessage: 'Send message',
  modelSelector: 'Select model',
  voiceInput: 'Dictate',
  conversationStarters: 'Conversation starters',
  conversationMessages: 'Conversation messages',
  sourcesPanelToggle: 'Open panel',
  sidebarToggle: 'Sidebar',
  mobileMenu: 'Navigation menu',
  chats: 'Chats and tasks',
  chatsSearch: 'Search chats',
  chatsFilter: 'Filter chats',
  signedInAs: 'Signed in as',
  usage: 'Usage',
  projectsCreate: 'New project',
  projectsSearch: 'Search projects',
  projectChats: 'Project chats',
  projectOutputs: 'Outputs',
  projectChatList: 'Chats',
  projectDetails: 'Details',
  scheduledTasksCreate: 'New task',
  scheduledTasksSearch: 'Search scheduled tasks by name',
  settings: 'Settings',
};

/* The pages below render the app shell's main landmark with this id. */
const resolve = (target: OnboardingHintTarget) =>
  resolveOnboardingTarget(target, labels, 'main-content');

const Page = ({ inertNav = false }: { inertNav?: boolean }) => (
  <>
    <nav aria-label="Main navigation" inert={inertNav}>
      <a href="/">New chat</a>
      <a href="/projects">Projects</a>
      <a href="/scheduled-tasks">Scheduled tasks</a>
      <a href="/catalog">Catalog</a>
      <a href="/file-manager">File manager</a>
    </nav>
    <main id="main-content">
      {/* Same name outside the nav must not win a nav target. */}
      <button type="button">Catalog</button>
      <textarea aria-label="Message" />
      <button type="button" aria-label="Add">
        +
      </button>
      <section aria-label="Catalog">
        <button type="button">Create</button>
        <div role="radiogroup" aria-label="View mode" />
        <div role="search">
          <input aria-label="Search the catalog" />
        </div>
        <div role="tablist" aria-label="Entity types" />
      </section>
    </main>
  </>
);

/* Every other surface at once: the sidebar with its chats section and
 * footer, a conversation, and the projects, project, scheduled tasks and
 * settings pages' controls. */
const AppPage = () => (
  <>
    <nav aria-label="Main navigation">
      <button type="button" aria-label="Sidebar" />
      <section aria-label="Chats and tasks">
        <button type="button">Chats and tasks</button>
        <button type="button" aria-label="Search chats" />
        <button type="button" aria-label="Filter chats" />
      </section>
      <a href="/usage" aria-label="Usage" />
      <button type="button" aria-label="Signed in as ann@example.com" />
    </nav>
    <main id="main-content">
      <div role="log" aria-label="Conversation messages" />
      <button type="button" aria-label="Open panel" />
      <div role="region" aria-label="Message input">
        <textarea aria-label="Message" />
        <button type="button" aria-label="Add" />
        <button type="button" aria-label="Dictate" />
        <button type="button" aria-label="Send message" />
        <button type="button" aria-label="Select model: GPT-4o" />
      </div>
      <div role="list" aria-label="Conversation starters" />
      <button type="button">New project</button>
      <div role="search">
        <input aria-label="Search projects" />
      </div>
      <section aria-label="Project chats" />
      <aside aria-labelledby="details-heading">
        <h2 id="details-heading">Details</h2>
      </aside>
      <button type="button">New task</button>
      <div role="search">
        <input aria-label="Search scheduled tasks by name" />
      </div>
      <h2 id="settings-heading">Settings</h2>
      <div role="tablist" aria-labelledby="settings-heading" />
    </main>
  </>
);

/* The file manager: a page-level "Add" button and no composer. */
const FileManagerPage = () => (
  <main id="main-content">
    <button type="button">Add</button>
    <header>
      <button type="button" aria-label="Navigation menu" />
    </header>
  </main>
);

/* The root page: the same controls exist, but not in a catalog region. */
const RootPage = () => (
  <main id="main-content">
    <button type="button">Create</button>
    <div role="tablist" aria-label="Other tabs" />
  </main>
);

describe('resolveOnboardingTarget', () => {
  beforeEach(() => {
    /* jsdom lays nothing out; give every element a box. */
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
      { top: 0, left: 0, width: 10, height: 10 },
    ] as unknown as DOMRectList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [OnboardingHintTarget.Projects, 'Projects'],
    [OnboardingHintTarget.ScheduledTasks, 'Scheduled tasks'],
    [OnboardingHintTarget.Catalog, 'Catalog'],
    [OnboardingHintTarget.FileManager, 'File manager'],
    [OnboardingHintTarget.NewChat, 'New chat'],
  ])('finds the %s link in the navigation', (target, name) => {
    render(<Page />);
    expect(resolve(target)).toBe(screen.getByRole('link', { name }));
  });

  it('finds the navigation landmark', () => {
    render(<Page />);
    expect(resolve(OnboardingHintTarget.Navigation)).toBe(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    );
  });

  it('finds the whole composer around the text field and Send button', () => {
    render(<AppPage />);
    expect(resolve(OnboardingHintTarget.ConversationInput)).toBe(
      screen.getByRole('region', { name: 'Message input' }),
    );
  });

  it('finds the composer and its + button', () => {
    render(<Page />);
    expect(resolve(OnboardingHintTarget.ConversationInput)).toBe(
      screen.getByRole('textbox', { name: 'Message' }),
    );
    expect(resolve(OnboardingHintTarget.AddAttachment)).toBe(
      screen.getByRole('button', { name: 'Add' }),
    );
  });

  it('finds the catalog controls inside the catalog region', () => {
    render(<Page />);
    const catalog = screen.getByRole('region', { name: 'Catalog' });
    expect(resolve(OnboardingHintTarget.CatalogCreate)).toBe(
      within(catalog).getByRole('button', { name: 'Create' }),
    );
    expect(resolve(OnboardingHintTarget.CatalogSearch)).toBe(
      within(catalog).getByRole('search'),
    );
    expect(resolve(OnboardingHintTarget.CatalogTabs)).toBe(
      within(catalog).getByRole('tablist'),
    );
    expect(resolve(OnboardingHintTarget.CatalogViewMode)).toBe(
      within(catalog).getByRole('radiogroup', { name: 'View mode' }),
    );
  });

  describe('catalog browsing', () => {
    const CatalogPage = ({ filter = 'From' }: { filter?: string }) => (
      <main id="main-content">
        <button type="button">Newest</button>
        <section aria-label="Catalog">
          <button type="button" aria-expanded="false">
            {filter}
          </button>
          <button type="button" aria-haspopup="menu" aria-label="Sort" />
          <article aria-label="GPT-4o">
            <button type="button" aria-label="Remove from favorites" />
          </article>
          <article aria-label="Planner">
            <button type="button" aria-label="Add to favorites" />
          </article>
        </section>
      </main>
    );

    it('finds the filter, the sort menu, the first card and its star', () => {
      render(<CatalogPage />);
      const catalog = screen.getByRole('region', { name: 'Catalog' });
      expect(resolve(OnboardingHintTarget.CatalogFilter)).toBe(
        within(catalog).getByRole('button', { name: 'From' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogSort)).toBe(
        within(catalog).getByRole('button', { name: 'Sort' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogCard)).toBe(
        within(catalog).getByRole('article', { name: 'GPT-4o' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogFavorite)).toBe(
        within(catalog).getByRole('button', { name: 'Remove from favorites' }),
      );
    });

    it.each(['From: 2 of 5', 'My', 'My · 2'])(
      'finds the filter while it reads %s',
      (filter) => {
        render(<CatalogPage filter={filter} />);
        expect(resolve(OnboardingHintTarget.CatalogFilter)).toBe(
          screen.getByRole('button', { name: filter }),
        );
      },
    );

    it('falls back to the browse-settings button for sorting on a phone', () => {
      render(
        <main id="main-content">
          <section aria-label="Catalog">
            <button type="button" aria-label="Browse settings" />
          </section>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.CatalogSort)).toBe(
        screen.getByRole('button', { name: 'Browse settings' }),
      );
    });
  });

  describe('message actions', () => {
    it('finds the action bar of the newest message', () => {
      render(
        <main id="main-content">
          <div role="log" aria-label="Conversation messages">
            <div role="toolbar" aria-label="Message actions">
              <button type="button">Copy</button>
            </div>
            <div role="toolbar" aria-label="Message actions">
              <button type="button">Regenerate</button>
            </div>
          </div>
        </main>,
      );
      const [, newest] = screen.getAllByRole('toolbar', {
        name: 'Message actions',
      });
      expect(resolve(OnboardingHintTarget.MessageActions)).toBe(newest);
    });

    it('skips an action bar hidden until hover', () => {
      render(
        <main id="main-content">
          <div role="log" aria-label="Conversation messages">
            <div role="toolbar" aria-label="Message actions" />
            <div
              role="toolbar"
              aria-label="Message actions"
              style={{ visibility: 'hidden' }}
            />
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.MessageActions)).toBe(
        screen.getAllByRole('toolbar', { name: 'Message actions' })[0],
      );
    });
  });

  it('finds no catalog control outside the catalog page', () => {
    render(<RootPage />);
    for (const target of [
      OnboardingHintTarget.CatalogCreate,
      OnboardingHintTarget.CatalogSearch,
      OnboardingHintTarget.CatalogTabs,
      OnboardingHintTarget.CatalogViewMode,
      OnboardingHintTarget.CatalogFilter,
      OnboardingHintTarget.CatalogSort,
      OnboardingHintTarget.CatalogCard,
      OnboardingHintTarget.CatalogFavorite,
    ]) {
      expect(resolve(target)).toBeNull();
    }
  });

  it('skips links inside an inert navigation, such as a closed drawer', () => {
    render(<Page inertNav />);
    expect(resolve(OnboardingHintTarget.Catalog)).toBeNull();
  });

  it('returns null for an element with no box', () => {
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue(
      [] as unknown as DOMRectList,
    );
    render(<Page />);
    expect(resolve(OnboardingHintTarget.Projects)).toBeNull();
  });

  describe('across the app', () => {
    it.each([
      [OnboardingHintTarget.SendMessage, 'button', 'Send message'],
      [OnboardingHintTarget.VoiceInput, 'button', 'Dictate'],
      [OnboardingHintTarget.ModelSelector, 'button', 'Select model: GPT-4o'],
      [OnboardingHintTarget.SourcesPanelToggle, 'button', 'Open panel'],
      [OnboardingHintTarget.SidebarToggle, 'button', 'Sidebar'],
      [OnboardingHintTarget.ChatsSearch, 'button', 'Search chats'],
      [OnboardingHintTarget.ChatsFilter, 'button', 'Filter chats'],
      [OnboardingHintTarget.UserMenu, 'button', 'Signed in as ann@example.com'],
      [OnboardingHintTarget.Usage, 'link', 'Usage'],
      [OnboardingHintTarget.ProjectsCreate, 'button', 'New project'],
      [OnboardingHintTarget.ScheduledTasksCreate, 'button', 'New task'],
      [OnboardingHintTarget.Chats, 'region', 'Chats and tasks'],
      [OnboardingHintTarget.ProjectChats, 'region', 'Project chats'],
      [OnboardingHintTarget.ProjectDetails, 'complementary', 'Details'],
      [
        OnboardingHintTarget.ConversationStarters,
        'list',
        'Conversation starters',
      ],
      [
        OnboardingHintTarget.ConversationMessages,
        'log',
        'Conversation messages',
      ],
      [OnboardingHintTarget.SettingsSections, 'tablist', 'Settings'],
    ] as const)('finds %s', (target, role, name) => {
      render(<AppPage />);
      expect(resolve(target)).toBe(screen.getByRole(role, { name }));
    });

    it.each([
      [OnboardingHintTarget.ProjectsSearch, 'Search projects'],
      [
        OnboardingHintTarget.ScheduledTasksSearch,
        'Search scheduled tasks by name',
      ],
    ])('finds the %s wrapper around its named input', (target, name) => {
      render(<AppPage />);
      const search = screen
        .getAllByRole('search')
        .find((element) => within(element).queryByRole('textbox', { name }));
      expect(resolve(target)).toBe(search);
    });

    it('finds the composer controls only around the composer', () => {
      render(<AppPage />);
      const composer = screen.getByRole('region', { name: 'Message input' });
      expect(resolve(OnboardingHintTarget.AddAttachment)).toBe(
        within(composer).getByRole('button', { name: 'Add' }),
      );
    });

    it('finds no composer control on a page without a composer', () => {
      render(<FileManagerPage />);
      expect(resolve(OnboardingHintTarget.AddAttachment)).toBeNull();
      expect(resolve(OnboardingHintTarget.SendMessage)).toBeNull();
    });

    it('falls back to the mobile menu button for the sidebar toggle', () => {
      render(<FileManagerPage />);
      expect(resolve(OnboardingHintTarget.SidebarToggle)).toBe(
        screen.getByRole('button', { name: 'Navigation menu' }),
      );
    });

    it('matches the model selector before a model is chosen', () => {
      render(
        <main id="main-content">
          <button type="button" aria-label="Select model" />
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ModelSelector)).toBe(
        screen.getByRole('button', { name: 'Select model' }),
      );
    });

    it('finds no user menu without the fixed part of its name', () => {
      render(<AppPage />);
      expect(
        resolveOnboardingTarget(
          OnboardingHintTarget.UserMenu,
          {
            ...labels,
            signedInAs: '',
          },
          'main-content',
        ),
      ).toBeNull();
    });

    it('finds no chats control while the sidebar is collapsed', () => {
      render(
        <nav aria-label="Main navigation">
          <section aria-label="Chats and tasks" inert>
            <button type="button" aria-label="Search chats" />
          </section>
        </nav>,
      );
      expect(resolve(OnboardingHintTarget.Chats)).toBeNull();
      expect(resolve(OnboardingHintTarget.ChatsSearch)).toBeNull();
    });
  });
  describe('catalog item details', () => {
    it('finds the drawer and its controls by the drawer name', () => {
      render(
        <>
          <button type="button">Use in chat</button>
          <div role="dialog" aria-label="Item details">
            <button type="button">Use in chat</button>
            <button type="button" aria-label="Manage" />
            <button type="button">Log in</button>
            <button type="button">Share</button>
            <button type="button">Unpublish</button>
            <div role="tablist" aria-label="Tabs" />
          </div>
        </>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Item details' });
      expect(resolve(OnboardingHintTarget.CatalogDetails)).toBe(dialog);
      expect(resolve(OnboardingHintTarget.CatalogDetailsUseInChat)).toBe(
        within(dialog).getByRole('button', { name: 'Use in chat' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogDetailsManage)).toBe(
        within(dialog).getByRole('button', { name: 'Manage' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogDetailsCredentials)).toBe(
        within(dialog).getByRole('button', { name: 'Log in' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogDetailsShare)).toBe(
        within(dialog).getByRole('button', { name: 'Share' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogDetailsPublish)).toBe(
        within(dialog).getByRole('button', { name: 'Unpublish' }),
      );
      expect(resolve(OnboardingHintTarget.CatalogDetailsTabs)).toBe(
        within(dialog).getByRole('tablist'),
      );
    });
  });

  describe('forms', () => {
    it('finds the project form and its submit button next to its Context section', () => {
      render(
        <main id="main-content">
          <header>
            <button type="button">Create</button>
          </header>
          <div>
            <section aria-labelledby="context-heading">
              <h2 id="context-heading">Context</h2>
            </section>
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ProjectFormContext)).toBe(
        screen.getByRole('region', { name: 'Context' }),
      );
      expect(resolve(OnboardingHintTarget.ProjectFormSubmit)).toBe(
        screen.getByRole('button', { name: 'Create' }),
      );
    });

    it('finds the scheduled task form, its pickers and its submit button', () => {
      render(
        <main id="main-content">
          <button type="button">Save</button>
          <div role="group" aria-label="Configuration" />
          <label htmlFor="repeat">Repeat</label>
          <button type="button" role="combobox" id="repeat" />
          <span id="model-label">Model or Agent*(required)</span>
          <button type="button" aria-labelledby="model-label" />
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskConfiguration)).toBe(
        screen.getByRole('group', { name: 'Configuration' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskFormSubmit)).toBe(
        screen.getByRole('button', { name: 'Save' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskRepeat)).toBe(
        screen.getByRole('combobox', { name: 'Repeat' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskModel)).toBe(
        screen.getByRole('button', { name: 'Model or Agent*(required)' }),
      );
    });

    it("finds the scheduled task form's details, skills, instructions, timezone and start date", () => {
      render(
        <main id="main-content">
          <div role="group" aria-label="Details">
            <button type="button">Change timezone</button>
            <span id="start-label">Start date</span>
            <span id="start-value">Pick start date</span>
            <div role="button" aria-labelledby="start-label start-value" />
          </div>
          <div role="group" aria-label="Configuration">
            <label htmlFor="skills">Skills</label>
            <button type="button" role="combobox" id="skills" />
            <div role="group" aria-labelledby="instructions-label">
              <label id="instructions-label" htmlFor="instructions">
                Instructions*
              </label>
              <button type="button">Refine with AI</button>
              <textarea id="instructions" />
            </div>
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskDetails)).toBe(
        screen.getByRole('group', { name: 'Details' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskSkills)).toBe(
        screen.getByRole('combobox', { name: 'Skills' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskInstructions)).toBe(
        screen.getByRole('group', { name: 'Instructions*' }),
      );
      expect(
        resolve(OnboardingHintTarget.ScheduledTaskRefineInstructions),
      ).toBe(screen.getByRole('button', { name: 'Refine with AI' }));
      expect(resolve(OnboardingHintTarget.ScheduledTaskTimezone)).toBe(
        screen.getByRole('button', { name: 'Change timezone' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskStartDate)).toBe(
        screen.getByRole('button', { name: 'Start date Pick start date' }),
      );
    });

    it('finds the instructions textarea when the field cannot be refined', () => {
      render(
        <main id="main-content">
          <div role="group" aria-label="Configuration">
            <label htmlFor="instructions">Instructions</label>
            <textarea id="instructions" />
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskInstructions)).toBe(
        screen.getByRole('textbox', { name: 'Instructions' }),
      );
      expect(
        resolve(OnboardingHintTarget.ScheduledTaskRefineInstructions),
      ).toBeNull();
    });

    it("skips the scheduled task form's controls inside an inert subtree", () => {
      render(
        <main id="main-content">
          <div role="group" aria-label="Details" inert>
            <button type="button">Change timezone</button>
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskDetails)).toBeNull();
      expect(resolve(OnboardingHintTarget.ScheduledTaskTimezone)).toBeNull();
    });

    it('finds no form submit button on a page without its form', () => {
      render(
        <main id="main-content">
          <button type="button">Create</button>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ProjectFormSubmit)).toBeNull();
      expect(resolve(OnboardingHintTarget.ScheduledTaskFormSubmit)).toBeNull();
    });
  });

  describe('project view', () => {
    it('finds the Outputs section and the Chats list inside the project chats', () => {
      render(
        <main id="main-content">
          <section aria-label="Project chats">
            <section aria-labelledby="outputs-heading">
              <h2 id="outputs-heading">Outputs</h2>
            </section>
            <section aria-labelledby="chats-heading">
              <h2 id="chats-heading">Chats</h2>
            </section>
          </section>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ProjectOutputs)).toBe(
        screen.getByRole('region', { name: 'Outputs' }),
      );
      expect(resolve(OnboardingHintTarget.ProjectChatList)).toBe(
        screen.getByRole('region', { name: 'Chats' }),
      );
    });

    it('finds no Outputs section before the project has outputs, nor one outside the project', () => {
      render(
        <main id="main-content">
          <section aria-label="Project chats" />
          <section aria-labelledby="outputs-heading">
            <h2 id="outputs-heading">Outputs</h2>
          </section>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ProjectOutputs)).toBeNull();
      expect(resolve(OnboardingHintTarget.ProjectChatList)).toBeNull();
    });

    it('finds the header actions next to the details panel', () => {
      render(
        <main id="main-content">
          <header>
            <button type="button">Unpin</button>
            <button type="button">Publish</button>
            <button type="button">Edit</button>
            <button type="button" aria-label="More actions" />
          </header>
          <aside aria-label="Details">
            <div role="search">
              <input aria-label="Search context files" />
            </div>
          </aside>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ProjectViewPin)).toBe(
        screen.getByRole('button', { name: 'Unpin' }),
      );
      expect(resolve(OnboardingHintTarget.ProjectViewPublish)).toBe(
        screen.getByRole('button', { name: 'Publish' }),
      );
      expect(resolve(OnboardingHintTarget.ProjectViewEdit)).toBe(
        screen.getByRole('button', { name: 'Edit' }),
      );
      expect(resolve(OnboardingHintTarget.ProjectViewMoreActions)).toBe(
        screen.getByRole('button', { name: 'More actions' }),
      );
      expect(resolve(OnboardingHintTarget.ProjectContextSearch)).toBe(
        screen.getByRole('search'),
      );
    });

    it('finds the projects sort button next to the projects search', () => {
      render(
        <main id="main-content">
          <section aria-label="Catalog">
            <button type="button" aria-label="Sort" />
          </section>
          <div role="toolbar" aria-label="Projects toolbar">
            <div role="search">
              <input aria-label="Search projects" />
            </div>
            <button type="button" aria-label="Sort" />
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ProjectsSort)).toBe(
        within(
          screen.getByRole('toolbar', { name: 'Projects toolbar' }),
        ).getByRole('button', { name: 'Sort' }),
      );
    });
  });

  describe('scheduled task view', () => {
    it('finds the task controls, its history and its switch', () => {
      render(
        <main id="main-content">
          <div>
            <button type="button">Edit</button>
            <button type="button">Start now</button>
            <label htmlFor="active">Active</label>
            <input id="active" type="checkbox" role="switch" />
          </div>
          <ul aria-label="History" />
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskStartNow)).toBe(
        screen.getByRole('button', { name: 'Start now' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskEdit)).toBe(
        screen.getByRole('button', { name: 'Edit' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskHistory)).toBe(
        screen.getByRole('list', { name: 'History' }),
      );
      expect(resolve(OnboardingHintTarget.ScheduledTaskActive)).toBe(
        screen.getByRole('switch', { name: 'Active' }),
      );
    });

    it('finds the list sort next to the page search, not the catalog one', () => {
      render(
        <main id="main-content">
          <section aria-label="Catalog">
            <button type="button" aria-label="Sort" />
          </section>
          <div aria-label="Scheduled tasks toolbar" role="toolbar">
            <div role="search">
              <input aria-label="Search scheduled tasks by name" />
            </div>
            <button type="button" aria-label="Sort" />
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ScheduledTasksSort)).toBe(
        within(
          screen.getByRole('toolbar', { name: 'Scheduled tasks toolbar' }),
        ).getByRole('button', { name: 'Sort' }),
      );
    });
  });

  describe('settings', () => {
    it('finds the extensions table, its log-in button and the pickers', () => {
      render(
        <main id="main-content">
          <div role="table" aria-label="Extensions">
            <button type="button">Log in</button>
          </div>
          <label htmlFor="theme">Theme</label>
          <button type="button" role="combobox" id="theme" />
          <label htmlFor="language">Language</label>
          <button type="button" role="combobox" id="language" />
        </main>,
      );
      expect(resolve(OnboardingHintTarget.SettingsExtensions)).toBe(
        screen.getByRole('table', { name: 'Extensions' }),
      );
      expect(resolve(OnboardingHintTarget.SettingsExtensionsLogIn)).toBe(
        screen.getByRole('button', { name: 'Log in' }),
      );
      expect(resolve(OnboardingHintTarget.SettingsTheme)).toBe(
        screen.getByRole('combobox', { name: 'Theme' }),
      );
      expect(resolve(OnboardingHintTarget.SettingsLanguage)).toBe(
        screen.getByRole('combobox', { name: 'Language' }),
      );
    });
  });

  describe('conversation', () => {
    it('finds the read-only duplicate button, the sources panel and the chat back button', () => {
      render(
        <>
          <main id="main-content">
            <button type="button">Back to Research</button>
            <button type="button">
              Duplicate the conversation to be able to edit it
            </button>
          </main>
          <aside aria-label="Conversation sources">
            <button type="button" aria-label="Download all" />
          </aside>
        </>,
      );
      expect(resolve(OnboardingHintTarget.DuplicateSharedChat)).toBe(
        screen.getByRole('button', {
          name: 'Duplicate the conversation to be able to edit it',
        }),
      );
      expect(resolve(OnboardingHintTarget.SourcesPanel)).toBe(
        screen.getByRole('complementary', { name: 'Conversation sources' }),
      );
      expect(resolve(OnboardingHintTarget.SourcesDownloadAll)).toBe(
        screen.getByRole('button', { name: 'Download all' }),
      );
      expect(resolve(OnboardingHintTarget.ProjectChatBack)).toBe(
        screen.getByRole('button', { name: 'Back to Research' }),
      );
    });

    it('finds the tools chip in the composer', () => {
      render(
        <main id="main-content">
          <div role="region" aria-label="Message input">
            <textarea aria-label="Message" />
            <button type="button" aria-label="Tools: 2 of 5 on" />
          </div>
        </main>,
      );
      expect(resolve(OnboardingHintTarget.ToolsSelector)).toBe(
        screen.getByRole('button', { name: 'Tools: 2 of 5 on' }),
      );
    });
  });

  it('finds the open conversation and its menu button', () => {
    render(
      <nav aria-label="Main navigation">
        <section aria-label="Chats and tasks">
          <ul>
            <li>
              <button type="button">Other chat</button>
              <button type="button" aria-label="More actions" />
            </li>
            <li>
              <button type="button" aria-current="page">
                Open chat
              </button>
              <button type="button" aria-label="More actions" />
            </li>
          </ul>
        </section>
      </nav>,
    );
    expect(resolve(OnboardingHintTarget.ActiveChat)).toBe(
      screen.getByRole('button', { name: 'Open chat' }),
    );
    expect(resolve(OnboardingHintTarget.ActiveChatActions)).toBe(
      screen.getAllByRole('button', { name: 'More actions' })[1],
    );
  });

  it("finds an editor's Setup section", () => {
    render(
      <main id="main-content">
        <section aria-labelledby="setup-heading">
          <h2 id="setup-heading">Setup</h2>
        </section>
      </main>,
    );
    expect(resolve(OnboardingHintTarget.EditorSetup)).toBe(
      screen.getByRole('region', { name: 'Setup' }),
    );
  });
});
