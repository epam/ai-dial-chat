import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createContext, useContext, useState, type FC } from 'react';
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
vi.mock('../../context/IsolatedModelViewContext', () => ({
  useIsolatedModelView: () => ({ isActive: false }),
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
  useIsMobile: () => false,
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
vi.mock('../../components/ChatLayout/ChatLayout', () => ({
  default: () => null,
}));
vi.mock(
  '../../components/ConversationSourcesPanel/ConversationSourcesPanel',
  () => ({ default: () => null }),
);
vi.mock('../../components/Header/Header', () => ({ default: () => null }));
vi.mock('../../components/Header/SourcesSidebarToggle', () => ({
  default: () => null,
}));
vi.mock('../../components/Navigation/Navigation', () => ({
  default: () => null,
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

beforeEach(() => {
  mocks.panelCommits = 0;
});

describe('App — conversation panel memo boundary', () => {
  it('does not re-render the conversation panel when an unrelated context value changes', async () => {
    render(<SidebarValueHost />);
    const commitsAfterMount = mocks.panelCommits;

    await userEvent.click(screen.getByRole('button', { name: BUMP_LABEL }));

    expect(mocks.panelCommits).toBe(commitsAfterMount);
  });
});
