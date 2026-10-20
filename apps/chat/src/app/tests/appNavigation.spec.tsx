import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createContext, useContext, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../app';

/*
 * Stands in for SourcesSidebarContext: the real one carries the displayed
 * conversation's messages, so every stream chunk hands App a new value.
 */
const SidebarValueContext = createContext<{ revision: number }>({
  revision: 0,
});

const mocks = vi.hoisted(() => ({
  isMobile: false,
  isPanelOpen: true,
  routeStateArgs: [] as Record<string, unknown>[],
  selectConversation: undefined as ((id: string) => void) | undefined,
  panelCommits: 0,
  closeSourcesPanel: () => undefined,
  closePanel: () => undefined,
  togglePanel: () => undefined,
  canvas: { closeCanvas: () => undefined, isOpen: false },
}));

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  AttachmentCanvasContainer: () => null,
  useAttachmentCanvas: () => mocks.canvas,
}));
vi.mock('@epam/ai-dial-chat-hooks/file-manager-canvas', () => ({
  clearAttachmentCache: vi.fn(),
}));
vi.mock('@epam/ai-dial-chat-hooks/viewport-layout', () => ({
  usePanelMaxWidth: () => 1200,
}));
vi.mock('../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => {
    useContext(SidebarValueContext);
    return { handleClose: mocks.closeSourcesPanel };
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
vi.mock('../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => mocks.isMobile,
}));
vi.mock('../../hooks/conversation/useConversationListBridge', () => ({
  useConversationListBridge: () => undefined,
}));
vi.mock(
  '../../hooks/conversation-panel/useConversationPanelRouteState',
  () => ({
    useConversationPanelRouteState: (args: Record<string, unknown>) => {
      mocks.routeStateArgs.push(args);
      return {
        isPanelOpen: mocks.isPanelOpen,
        closePanel: mocks.closePanel,
        togglePanel: mocks.togglePanel,
      };
    },
  }),
);
vi.mock('../../hooks/overlay/useOverlayPendingModel', () => ({
  useOverlayPendingModel: () => undefined,
}));
vi.mock('../../hooks/useAppVersionCheck/useAppVersionCheck', () => ({
  useAppVersionCheck: () => ({ isNewVersionAvailable: false }),
}));
vi.mock('../../hooks/useUiFeature', () => ({
  useUiFeature: () => false,
}));
vi.mock('../../utils/pdf', () => ({ configurePdfWorker: vi.fn() }));

vi.mock(
  '../../components/ConversationPanel/ConversationPanelView',
  async () => {
    const { memo } = await import('react');
    return {
      default: memo(
        ({
          onSelectConversation,
        }: {
          onSelectConversation: (id: string) => void;
        }) => {
          mocks.panelCommits += 1;
          mocks.selectConversation = onSelectConversation;
          return <div aria-label="conversation panel view" />;
        },
      ),
    };
  },
);
vi.mock('../../components/AnnouncementBanner/AnnouncementBanner', () => ({
  default: () => null,
}));
vi.mock('../../components/ChatLayout/ChatLayout', () => ({
  default: () => null,
}));
vi.mock(
  '../../components/ConversationSourcesPanel/ConversationSourcesPanel',
  () => ({ default: () => null }),
);
vi.mock('../../components/Header/Header', () => ({
  default: ({
    onMenuToggle,
    isMenuOpen,
  }: {
    onMenuToggle: () => void;
    isMenuOpen?: boolean;
  }) => (
    <button type="button" aria-pressed={isMenuOpen} onClick={onMenuToggle}>
      toggle sidebar
    </button>
  ),
}));
vi.mock('../../components/Header/SourcesSidebarToggle', () => ({
  default: () => null,
}));
vi.mock('../../components/Navigation/SidebarNavigation', () => ({
  default: ({
    chats,
    isCollapsed,
    isOpen,
  }: {
    chats?: ReactNode;
    isCollapsed?: boolean;
    isOpen?: boolean;
  }) => (
    <nav
      aria-label="sidebar navigation"
      data-collapsed={String(isCollapsed)}
      data-open={String(isOpen)}
    >
      {chats}
    </nav>
  ),
}));
vi.mock('../../components/NewVersionFallback/NewVersionFallback', () => ({
  default: () => null,
}));
vi.mock('../../components/SigninInterruptDialog/SigninInterruptDialog', () => ({
  default: () => null,
}));
vi.mock('../../pages/ConversationRoute/ConversationRoute', () => ({
  default: () => null,
}));
vi.mock('../../pages/Conversation/Conversation', () => ({
  ConversationPage: () => null,
}));

const renderApp = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.isMobile = false;
  mocks.isPanelOpen = true;
  mocks.routeStateArgs = [];
});

const getSidebar = () =>
  screen.getByRole('navigation', { name: 'sidebar navigation' });

describe('App — navigation', () => {
  it('renders the panel view inside the sidebar on a desktop viewport', () => {
    renderApp();

    expect(
      within(getSidebar()).getByLabelText('conversation panel view'),
    ).toBeTruthy();
    expect(screen.getAllByLabelText('conversation panel view')).toHaveLength(1);
  });

  it('renders the same sidebar at a mobile width', () => {
    mocks.isMobile = true;
    renderApp();

    expect(
      within(getSidebar()).getByLabelText('conversation panel view'),
    ).toBeTruthy();
  });

  it('passes the collapsed state to the sidebar', () => {
    mocks.isPanelOpen = false;
    renderApp();

    expect(getSidebar().getAttribute('data-collapsed')).toBe('true');
  });

  it('tells the route-state hook about the viewport', () => {
    renderApp();

    expect(mocks.routeStateArgs.at(-1)).toMatchObject({ isMobile: false });
  });

  it('keeps the mobile drawer closed until the header toggle opens it', async () => {
    mocks.isMobile = true;
    renderApp();
    expect(getSidebar().getAttribute('data-open')).toBe('false');

    await userEvent.click(
      screen.getByRole('button', { name: 'toggle sidebar' }),
    );

    expect(getSidebar().getAttribute('data-open')).toBe('true');
  });

  it('makes the page behind the open mobile drawer inert, and restores it on close', async () => {
    mocks.isMobile = true;
    renderApp();
    const getMain = () => screen.getByRole('main', { hidden: true });
    expect(getMain().hasAttribute('inert')).toBe(false);

    await userEvent.click(
      screen.getByRole('button', { name: 'toggle sidebar' }),
    );
    expect(getMain().hasAttribute('inert')).toBe(true);

    act(() => mocks.selectConversation?.('chat-1'));
    expect(getMain().hasAttribute('inert')).toBe(false);
  });

  it('leaves the page interactive beside the desktop sidebar', () => {
    mocks.isMobile = false;
    renderApp();

    expect(screen.getByRole('main').hasAttribute('inert')).toBe(false);
  });

  it('closes the mobile drawer behind a chat the user picks', async () => {
    mocks.isMobile = true;
    renderApp();
    await userEvent.click(
      screen.getByRole('button', { name: 'toggle sidebar' }),
    );
    expect(getSidebar().getAttribute('data-open')).toBe('true');

    act(() => mocks.selectConversation?.('chat-1'));

    expect(getSidebar().getAttribute('data-open')).toBe('false');
  });
});
