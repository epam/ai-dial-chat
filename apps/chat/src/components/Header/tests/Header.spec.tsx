import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AriaAttributes, ComponentProps } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_SIDEBAR_ID } from '../../../constants/layout';
import {
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationPanelI18nKeys,
  NavigationI18nKeys,
  SidebarI18nKeys,
} from '../../../constants/translation-keys';
import { SourcesSidebarProvider } from '../../../context/SourcesSidebarContext';
import * as ThemeContext from '../../../context/ThemeContext';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import { ROUTES } from '../../../types/routes';
import Header from '../Header';

vi.mock('../../../context/ThemeContext');
vi.mock('../../../hooks/useUiFeature');
vi.mock('../../../utils/icon-path');
vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  useAttachmentCanvas: () => ({ closeCanvas: vi.fn() }),
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { LG: 24 },
  GhostIconButton: ({
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    onClick,
  }: {
    'aria-label': string;
    'aria-pressed'?: AriaAttributes['aria-pressed'];
    'aria-expanded'?: AriaAttributes['aria-expanded'];
    'aria-controls'?: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      onClick={onClick}
    />
  ),
}));

const renderHeader = (
  props?: Partial<ComponentProps<typeof Header>>,
  route = `${ROUTES.Conversations}/test`,
) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <SourcesSidebarProvider>
        <Header onMenuToggle={vi.fn()} {...props} />
      </SourcesSidebarProvider>
    </MemoryRouter>,
  );

describe('Header', () => {
  const mockUseTheme = vi.mocked(ThemeContext.useTheme);
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      currentThemeLogo: 'logo.svg',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });
    mockUseUiFeature.mockImplementation(
      (feature) =>
        feature !== OverlayFeature.HideNewConversation &&
        feature !== OverlayFeature.HideNavigationMenu,
    );
  });

  it('renders the sidebar toggle by default, closed and pointing at the drawer', () => {
    renderHeader();

    const toggle = screen.getByRole('button', {
      name: NavigationI18nKeys.Menu,
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(MOBILE_SIDEBAR_ID);
  });

  it('reports the drawer as expanded while it is open', () => {
    renderHeader({ isMenuOpen: true });

    expect(
      screen
        .getByRole('button', { name: NavigationI18nKeys.Menu })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('opens the drawer through the toggle', async () => {
    const onMenuToggle = vi.fn();
    renderHeader({ onMenuToggle });

    await userEvent.click(
      screen.getByRole('button', { name: NavigationI18nKeys.Menu }),
    );

    expect(onMenuToggle).toHaveBeenCalledOnce();
  });

  it('hides the toggle under hide-navigation-menu when the chats toggle is off', () => {
    mockUseUiFeature.mockImplementation(
      (feature) =>
        feature !== OverlayFeature.HideNewConversation &&
        feature !== OverlayFeature.ConversationsPanelToggle,
    );
    renderHeader();

    expect(
      screen.queryByRole('button', { name: NavigationI18nKeys.Menu }),
    ).toBeNull();
  });

  it('hides the toggle when hide-navigation-menu is on and the conversations section is off', () => {
    mockUseUiFeature.mockImplementation(
      (feature) =>
        feature !== OverlayFeature.HideNewConversation &&
        feature !== OverlayFeature.ConversationsSection,
    );
    renderHeader();

    expect(
      screen.queryByRole('button', { name: NavigationI18nKeys.Menu }),
    ).toBeNull();
  });

  it('keeps the toggle under hide-navigation-menu while the chats stay reachable', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.HideNewConversation,
    );
    renderHeader();

    expect(
      screen.getByRole('button', {
        name: ConversationPanelI18nKeys.ChatsAndTasks,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: NavigationI18nKeys.Menu }),
    ).toBeNull();
  });

  it('renders Header component', () => {
    renderHeader();
    expect(screen.getByRole('banner')).toBeTruthy();
  });

  it('renders Logo component inside Header', () => {
    renderHeader();
    expect(screen.getByLabelText(ChatI18nKeys.Logo)).toBeTruthy();
  });

  it('applies expected container classes', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header?.classList.contains('relative')).toBe(true);
    expect(header?.classList.contains('z-30')).toBe(true);
    expect(header?.classList.contains('min-h-[48px]')).toBe(true);
    expect(header?.classList.contains('w-full')).toBe(true);
    expect(header?.classList.contains('border-b')).toBe(true);
  });

  it('renders the sidebar toggle button with open label when closed', () => {
    renderHeader();
    expect(
      screen.getByRole('button', { name: SidebarI18nKeys.ToggleOpen }),
    ).toBeTruthy();
  });

  it('toggle button starts with aria-pressed=false', () => {
    renderHeader();
    const btn = screen.getByRole('button', {
      name: SidebarI18nKeys.ToggleOpen,
    });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking toggle hides the button (sidebar open state handled by sidebar X)', async () => {
    const user = userEvent.setup();
    renderHeader();
    const btn = screen.getByRole('button', {
      name: SidebarI18nKeys.ToggleOpen,
    });
    await user.click(btn);
    /*
     * When sidebar is open the file-icon toggle disappears from the header —
     * the X button lives inside the sidebar panel itself.
     */
    expect(
      screen.queryByRole('button', { name: SidebarI18nKeys.ToggleOpen }),
    ).toBeNull();
  });

  it('does not render when the header and show-header-logo features are disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) =>
        feature !== OverlayFeature.Header &&
        feature !== OverlayFeature.ShowHeaderLogo,
    );
    renderHeader();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('renders only the logo when show-header-logo is enabled without the header', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.ShowHeaderLogo,
    );
    renderHeader();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByLabelText(ChatI18nKeys.Logo)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the new-conversation button when hide-new-conversation is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) =>
        feature === OverlayFeature.Header ||
        feature === OverlayFeature.HideNewConversation,
    );
    renderHeader({ onNewChat: vi.fn() });
    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.NewChat }),
    ).toBeNull();
  });

  it('shows the new-conversation button when hide-new-conversation is disabled', () => {
    renderHeader({ onNewChat: vi.fn() });
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.NewChat }),
    ).toBeTruthy();
  });

  it('shows the new-conversation button on the start page too', () => {
    renderHeader({ onNewChat: vi.fn() }, ROUTES.Root);

    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.NewChat }),
    ).toBeTruthy();
  });

  it('starts a new chat through the plus button', async () => {
    const onNewChat = vi.fn();
    renderHeader({ onNewChat });

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.NewChat }),
    );

    expect(onNewChat).toHaveBeenCalledOnce();
  });
});
