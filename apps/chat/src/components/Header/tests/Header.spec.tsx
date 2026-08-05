import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AriaAttributes, ComponentProps } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationPanelI18nKeys,
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
  DIAL_ICON_SIZE: { LG: 24 },
  GhostIconButton: ({
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
    onClick,
  }: {
    'aria-label': string;
    'aria-pressed'?: AriaAttributes['aria-pressed'];
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={onClick}
    />
  ),
}));

const renderHeader = (props?: Partial<ComponentProps<typeof Header>>) =>
  render(
    <MemoryRouter initialEntries={[`${ROUTES.Conversations}/test`]}>
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
      (feature) => feature !== OverlayFeature.HideNewConversation,
    );
  });

  it('renders Header component', () => {
    const { container } = renderHeader();
    expect(container.querySelector('header')).toBeTruthy();
  });

  it('renders Logo component inside Header', () => {
    renderHeader();
    expect(screen.getByLabelText(ChatI18nKeys.Logo)).toBeTruthy();
  });

  it('applies expected container classes', () => {
    const { container } = renderHeader();
    const header = container.querySelector('header');
    expect(header?.classList.contains('relative')).toBe(true);
    expect(header?.classList.contains('z-30')).toBe(true);
    expect(header?.classList.contains('min-h-[64px]')).toBe(true);
    expect(header?.classList.contains('w-full')).toBe(true);
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

  it('does not render when the header feature is disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.Header,
    );
    const { container } = renderHeader();
    expect(container.querySelector('header')).toBeNull();
  });

  it('hides the conversations-panel-toggle button when the feature is disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.ConversationsPanelToggle,
    );
    renderHeader({ onConversationPanelToggle: vi.fn() });
    expect(
      screen.queryByRole('button', {
        name: ConversationPanelI18nKeys.ToggleAriaLabel,
      }),
    ).toBeNull();
  });

  it('shows the conversations-panel-toggle button when the feature is enabled', () => {
    renderHeader({ onConversationPanelToggle: vi.fn() });
    expect(
      screen.getByRole('button', {
        name: ConversationPanelI18nKeys.ToggleAriaLabel,
      }),
    ).toBeTruthy();
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
});
