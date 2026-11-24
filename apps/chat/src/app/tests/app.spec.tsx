import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createContext,
  useContext,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../app';

const BUMP_LABEL = 'bump sidebar value';

/*
 * Stands in for SourcesSidebarContext: the real one carries the displayed
 * conversation's messages, so every stream chunk hands App a new value.
 */
const SidebarValueContext = createContext<{ revision: number }>({
  revision: 0,
});

const mocks = vi.hoisted(() => ({
  panelCommits: 0,
  closeSourcesPanel: () => undefined,
  closePanel: vi.fn(),
  togglePanel: () => undefined,
  canvas: { closeCanvas: () => undefined, isOpen: false },
  enabledFeatures: new Set<string>(),
  canvasProps: null as {
    minWidth?: number;
    leftActions?: ReactNode;
    isMobile?: boolean;
    isBoundedOverlay?: boolean;
  } | null,
  isMobile: false,
  isTablet: false,
  isSourcesOpen: false,
  isAfterLoadIdle: false,
}));

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  AttachmentCanvasContainer: (props: {
    minWidth?: number;
    leftActions?: ReactNode;
    isMobile?: boolean;
    isBoundedOverlay?: boolean;
  }) => {
    mocks.canvasProps = props;
    return <aside aria-label="attachment canvas" />;
  },
  useAttachmentCanvas: () => mocks.canvas,
}));
vi.mock('../../hooks/attachment/useMcpAppHostAdapter', () => ({
  useMcpAppHostAdapter: () => ({ hostContext: undefined }),
}));
vi.mock('@epam/ai-dial-chat-hooks/file-manager-canvas', () => ({
  clearAttachmentCache: vi.fn(),
}));
vi.mock('@epam/ai-dial-chat-hooks/viewport-layout', async (original) => ({
  ...(await original<
    typeof import('@epam/ai-dial-chat-hooks/viewport-layout')
  >()),
  usePanelMaxWidth: () => 1200,
  useViewportWidth: () => 1440,
}));
vi.mock('../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => {
    useContext(SidebarValueContext);
    return {
      handleClose: mocks.closeSourcesPanel,
      isOpen: mocks.isSourcesOpen,
    };
  },
}));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'dark' }),
}));
vi.mock('../../context/ActiveScheduledTaskContext', () => ({
  ActiveScheduledTaskProvider: ({ children }: { children: unknown }) =>
    children,
}));
vi.mock('../../hooks/attachment/useCanvasVisualizerMessageHandler', () => ({
  useCanvasVisualizerMessageHandler: () => undefined,
}));
vi.mock('../../hooks/attachment/usePdfPreviewLoader', () => ({
  usePdfPreviewLoader: () => undefined,
}));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsMobile: () => mocks.isMobile,
  useIsTablet: () => mocks.isTablet,
}));
vi.mock('../../hooks/conversation/useConversationListBridge', () => ({
  useConversationListBridge: () => undefined,
}));
vi.mock(
  '../../hooks/conversation-panel/useConversationPanelRouteState',
  () => ({
    useConversationPanelRouteState: () => ({
      isPanelOpen: true,
      closePanel: mocks.closePanel,
      togglePanel: mocks.togglePanel,
    }),
  }),
);
vi.mock('../../hooks/overlay/useOverlayPendingModel', () => ({
  useOverlayPendingModel: () => undefined,
}));
vi.mock('@epam/ai-dial-chat-hooks/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks/utils')>()),
  useAppVersionCheck: () => ({ isNewVersionAvailable: false }),
}));
vi.mock('../../hooks/useUiFeature', () => ({
  useUiFeature: (feature: string) => mocks.enabledFeatures.has(feature),
}));
vi.mock('../../utils/pdf', () => ({ configurePdfWorker: vi.fn() }));

vi.mock(
  '../../components/ConversationPanel/ConversationPanelView',
  async () => {
    const { memo } = await import('react');
    return {
      default: memo(() => {
        mocks.panelCommits += 1;
        return null;
      }),
    };
  },
);
vi.mock('../../components/AnnouncementBanner/AnnouncementBanner', () => ({
  default: () => null,
}));
vi.mock('../../hooks/useIsAfterLoadIdle', () => ({
  useIsAfterLoadIdle: () => mocks.isAfterLoadIdle,
}));
vi.mock('../../components/OnboardingHints/OnboardingHints', () => ({
  default: () => <p>onboarding tour</p>,
}));
vi.mock('../../components/ChatLayout/ChatLayout', () => ({
  default: () => null,
}));
vi.mock(
  '../../components/ConversationSourcesPanel/ConversationSourcesPanel',
  () => ({ default: () => <aside aria-label="sources panel" /> }),
);
vi.mock('../../components/Header/Header', () => ({ default: () => null }));
vi.mock('../../components/Header/SourcesSidebarToggle', () => ({
  default: () => <button>sources toggle</button>,
}));
vi.mock('../../components/Navigation/SidebarNavigation', () => ({
  default: ({ chats }: { chats?: ReactNode }) => <nav>{chats}</nav>,
}));
vi.mock('../../components/NewVersionFallback/NewVersionFallback', () => ({
  default: () => null,
}));
vi.mock('../../components/SigninInterruptGate/SigninInterruptGate', () => ({
  default: () => null,
}));
vi.mock('../../pages/ConversationRoute/ConversationRoute', () => ({
  default: () => null,
}));
vi.mock('../../pages/Conversation/Conversation', () => ({
  ConversationPage: () => null,
}));
vi.mock('../../pages/DialFileManagerPage/DialFileManagerPage', () => ({
  default: () => null,
}));
vi.mock('../../components/CatalogView/CatalogView', () => ({
  default: () => null,
}));
vi.mock('../../pages/ProjectsPage/ProjectsPage', () => ({
  default: () => <p>Projects list page</p>,
}));
vi.mock('../../pages/ProjectCreatePage/ProjectCreatePage', () => ({
  default: () => <p>New project page</p>,
}));
vi.mock('../../pages/ProjectEditPage/ProjectEditPage', () => ({
  default: () => <p>Edit project page</p>,
}));
vi.mock('../../pages/ProjectViewPage/ProjectViewPage', () => ({
  default: () => <p>View project page</p>,
}));

const SidebarValueHost: FC = () => {
  const [value, setValue] = useState({ revision: 0 });
  return (
    <SidebarValueContext.Provider value={value}>
      <button
        onClick={() => setValue((prev) => ({ revision: prev.revision + 1 }))}
      >
        {BUMP_LABEL}
      </button>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </SidebarValueContext.Provider>
  );
};

describe('app', () => {
  beforeEach(() => {
    mocks.panelCommits = 0;
    mocks.enabledFeatures = new Set();
    mocks.canvasProps = null;
    mocks.isMobile = false;
    mocks.isTablet = false;
    mocks.isSourcesOpen = false;
    mocks.isAfterLoadIdle = false;
    mocks.canvas.isOpen = false;
  });

  describe('App — conversation panel memo boundary', () => {
    it('does not re-render the conversation panel when an unrelated context value changes', async () => {
      render(<SidebarValueHost />);
      const commitsAfterMount = mocks.panelCommits;

      await userEvent.click(screen.getByRole('button', { name: BUMP_LABEL }));

      expect(mocks.panelCommits).toBe(commitsAfterMount);
    });
  });

  describe('App — attachment canvas container mounting', () => {
    /* These cover where the canvas may appear once the page has loaded. */
    beforeEach(() => {
      mocks.isAfterLoadIdle = true;
    });

    const renderAt = async (
      path: string,
      features: OverlayFeature[] = [],
    ): Promise<void> => {
      mocks.enabledFeatures = new Set(features);
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      await screen.findByRole('main');
    };

    const queryCanvas = () => screen.queryByLabelText('attachment canvas');

    // The canvas container is lazy, so a route that shows it mounts it a tick after `main`.
    const renderWithCanvas = async (
      path: string,
      features: OverlayFeature[] = [],
    ): Promise<void> => {
      await renderAt(path, features);
      await screen.findByLabelText('attachment canvas');
    };

    it('renders the canvas on the file manager page with AttachmentsManager disabled', async () => {
      await renderWithCanvas('/files', [OverlayFeature.FileManager]);

      expect(queryCanvas()).toBeTruthy();
    });

    it('gives the file manager page a 400 px minimum width', async () => {
      await renderWithCanvas('/files', [OverlayFeature.FileManager]);

      expect(mocks.canvasProps?.minWidth).toBe(400);
    });

    it('renders the canvas on a conversation route when AttachmentsManager is enabled', async () => {
      await renderWithCanvas('/', [OverlayFeature.AttachmentsManager]);

      expect(queryCanvas()).toBeTruthy();
    });

    it('keeps the canvas default minimum on a conversation route', async () => {
      await renderWithCanvas('/', [OverlayFeature.AttachmentsManager]);

      expect(mocks.canvasProps?.minWidth).toBeUndefined();
    });

    it('does not render the canvas on a conversation route when AttachmentsManager is disabled', async () => {
      await renderAt('/');

      expect(queryCanvas()).toBeNull();
    });

    it('does not render the canvas on other routes', async () => {
      await renderAt('/catalog', [OverlayFeature.AttachmentsManager]);

      expect(queryCanvas()).toBeNull();
    });

    it.each([
      ['New project', '/projects/new'],
      ['project edit', '/projects/edit/bucket-1/projects/support'],
      ['project view', '/projects/view/bucket-1/projects/support'],
    ])(
      'renders the canvas on the %s page without the AttachmentsManager feature',
      async (_, path) => {
        await renderWithCanvas(path);

        expect(queryCanvas()).toBeTruthy();
      },
    );

    it('does not render the canvas on the projects list', async () => {
      await renderAt('/projects');

      expect(queryCanvas()).toBeNull();
    });

    it('keeps the conversation default width on a project page', async () => {
      await renderWithCanvas('/projects/new');

      expect(mocks.canvasProps?.minWidth).toBeUndefined();
    });

    it('opts project previews into a bounded overlay without changing the mobile layout signal', async () => {
      mocks.isMobile = true;
      mocks.isTablet = true;
      await renderWithCanvas('/projects/new');
      expect(mocks.canvasProps?.isBoundedOverlay).toBe(true);
      expect(mocks.canvasProps?.isMobile).toBe(true);
      expect(mocks.closePanel).not.toHaveBeenCalled();
    });

    it('renders the canvas in its mobile full-screen mode on a mobile project page', async () => {
      mocks.isMobile = true;
      await renderWithCanvas('/projects/new');

      expect(queryCanvas()).toBeTruthy();
      expect(mocks.canvasProps?.isMobile).toBe(true);
    });

    it('offers no sources toggle in the canvas header on a mobile project page', async () => {
      mocks.isMobile = true;
      await renderWithCanvas('/projects/view/bucket-1/projects/support');

      expect(mocks.canvasProps?.leftActions).toBeUndefined();
    });

    it('keeps the sources toggle in the canvas header on a mobile conversation route', async () => {
      mocks.isMobile = true;
      await renderWithCanvas('/', [OverlayFeature.AttachmentsManager]);

      expect(mocks.canvasProps?.leftActions).toBeTruthy();
    });
  });

  describe('App — closed overlays while the page loads', () => {
    const renderAt = async (
      path: string,
      features: OverlayFeature[] = [],
    ): Promise<void> => {
      mocks.enabledFeatures = new Set(features);
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      await screen.findByRole('main');
    };

    it('mounts no closed canvas, sources panel or onboarding tour before the page has loaded', async () => {
      await renderAt('/', [OverlayFeature.AttachmentsManager]);

      expect(screen.queryByLabelText('attachment canvas')).toBeNull();
      expect(screen.queryByLabelText('sources panel')).toBeNull();
      expect(screen.queryByText('onboarding tour')).toBeNull();
    });

    it('mounts the canvas as soon as it opens, even before the page has loaded', async () => {
      mocks.canvas.isOpen = true;
      await renderAt('/files', [OverlayFeature.FileManager]);

      expect(await screen.findByLabelText('attachment canvas')).toBeTruthy();
    });

    it('mounts the sources panel as soon as it opens, even before the page has loaded', async () => {
      mocks.isSourcesOpen = true;
      await renderAt('/');

      expect(await screen.findByLabelText('sources panel')).toBeTruthy();
    });

    it('mounts the closed overlays and the onboarding tour once the page has loaded', async () => {
      mocks.isAfterLoadIdle = true;
      await renderAt('/', [OverlayFeature.AttachmentsManager]);

      expect(await screen.findByLabelText('attachment canvas')).toBeTruthy();
      expect(await screen.findByLabelText('sources panel')).toBeTruthy();
      expect(await screen.findByText('onboarding tour')).toBeTruthy();
    });
  });

  describe('App — projects routes', () => {
    it('renders the New project page on /projects/new', async () => {
      render(
        <MemoryRouter initialEntries={['/projects/new']}>
          <App />
        </MemoryRouter>,
      );

      expect(await screen.findByText('New project page')).toBeTruthy();
      expect(screen.queryByText('Projects list page')).toBeNull();
    });

    it('keeps the list page on /projects', async () => {
      render(
        <MemoryRouter initialEntries={['/projects']}>
          <App />
        </MemoryRouter>,
      );

      expect(await screen.findByText('Projects list page')).toBeTruthy();
    });
  });
});
