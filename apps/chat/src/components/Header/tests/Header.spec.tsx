import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AriaAttributes } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../constants/routes';
import {
  ChatI18nKeys,
  SidebarI18nKeys,
} from '../../../constants/translation-keys';
import { SourcesSidebarProvider } from '../../../context/SourcesSidebarContext';
import * as ThemeContext from '../../../context/ThemeContext';
import Header from '../Header';

vi.mock('../../../context/ThemeContext');
vi.mock('../../../utils/icon-path');
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  DialGhostIconButton: ({
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

const renderHeader = () =>
  render(
    <MemoryRouter initialEntries={[`${ROUTES.CONVERSATIONS}/test`]}>
      <SourcesSidebarProvider>
        <Header onMenuToggle={vi.fn()} />
      </SourcesSidebarProvider>
    </MemoryRouter>,
  );

describe('Header', () => {
  const mockUseTheme = vi.mocked(ThemeContext.useTheme);

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
    expect(header?.classList.contains('min-h-[49px]')).toBe(true);
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
    // When sidebar is open the file-icon toggle disappears from the header —
    // the X button lives inside the sidebar panel itself.
    expect(
      screen.queryByRole('button', { name: SidebarI18nKeys.ToggleOpen }),
    ).toBeNull();
  });
});
