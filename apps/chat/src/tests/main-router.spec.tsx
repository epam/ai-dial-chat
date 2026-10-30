import { render, screen } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, useBlocker } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import AppRoot from '../AppRoot';

/*
 * The real providers fetch config, auth and conversations on mount; this spec
 * only proves the router shape, so every provider is a pass-through.
 */
const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  AttachmentCanvasProvider: passThrough,
}));
vi.mock('../components/Notification/NotificationContainer', () => ({
  default: () => null,
}));
vi.mock('../components/RequireAuth/RequireAuth', () => ({
  default: passThrough,
}));
vi.mock('../context/AppConfigContext', () => ({ default: passThrough }));
vi.mock('../context/auth/UserContext', () => ({ UserProvider: passThrough }));
vi.mock('../context/CelebrationHost', () => ({ CelebrationHost: passThrough }));
vi.mock('../context/ClientChannelContext', () => ({
  ClientChannelProvider: passThrough,
}));
vi.mock('../context/ConversationDataSourceContext', () => ({
  ConversationDataSourceProvider: passThrough,
}));
vi.mock('../context/ConversationPanelContext', () => ({
  ConversationPanelProvider: passThrough,
}));
vi.mock('../context/ConversationsContext', () => ({
  ConversationsProvider: passThrough,
}));
vi.mock('../context/DeploymentsContext', () => ({
  DeploymentsProvider: passThrough,
}));
vi.mock('../context/FavoriteApplicationsContext', () => ({
  FavoriteApplicationsProvider: passThrough,
}));
vi.mock('../context/GenerationContext', () => ({
  GenerationProvider: passThrough,
}));
vi.mock('../context/IsolatedModelViewContext', () => ({
  IsolatedModelViewProvider: passThrough,
}));
vi.mock('../context/NotificationContext', () => ({
  NotificationProvider: passThrough,
}));
vi.mock('../context/overlay/OverlayContext', () => ({
  OverlayModeGate: passThrough,
}));
vi.mock('../context/PromptsContext', () => ({ PromptsProvider: passThrough }));
vi.mock('../context/SkillsContext', () => ({ SkillsProvider: passThrough }));
vi.mock('../context/SourcesSidebarContext', () => ({
  SourcesSidebarProvider: passThrough,
}));
vi.mock('../context/ThemeContext', () => ({ ThemeProvider: passThrough }));
vi.mock('../context/UiFeaturesContext', () => ({
  UiFeaturesProvider: passThrough,
}));
vi.mock('../context/UnsavedChangesContext', () => ({
  UnsavedChangesProvider: passThrough,
}));
vi.mock('../context/UserConfigContext', () => ({
  UserConfigProvider: passThrough,
}));
vi.mock('../context/VisualizerMessageContext', () => ({
  VisualizerMessageProvider: passThrough,
}));
vi.mock('../pages/auth/Login', () => ({
  default: () => <p>Login page</p>,
}));
vi.mock('../pages/auth/OverlayClose', () => ({
  default: () => <p>Overlay close page</p>,
}));
vi.mock('../app/app', () => ({
  default: () => <p>Authenticated app</p>,
}));

const BlockerProbe: FC = () => {
  useBlocker(false);
  return <p>Blocker probe</p>;
};

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <BlockerProbe />
            <AppRoot />
          </>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
};

describe('AppRoot', () => {
  it('lets useBlocker run without the data-router invariant', async () => {
    renderAt('/');

    expect(screen.getByText('Blocker probe')).toBeTruthy();
    expect(await screen.findByText('Authenticated app')).toBeTruthy();
  });

  it('still resolves /login to the login page', async () => {
    renderAt('/login');

    expect(await screen.findByText('Login page')).toBeTruthy();
    expect(screen.queryByText('Authenticated app')).toBeNull();
  });

  it('still resolves /overlay-close to its page', async () => {
    renderAt('/overlay-close');

    expect(await screen.findByText('Overlay close page')).toBeTruthy();
  });
});
