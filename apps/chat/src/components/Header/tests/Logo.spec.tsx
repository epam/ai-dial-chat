import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatI18nKeys } from '../../../constants/translation-keys';
import * as ThemeContext from '../../../context/ThemeContext';
import * as iconPathUtils from '../../../utils/icon-path';
import Logo from '../Logo';

const celebration = vi.hoisted(() => ({
  event: null as { iconUrl: string } | null,
}));
vi.mock('../../../context/CelebrationContext', () => ({
  useCelebration: () => celebration,
}));

vi.mock('../../../context/ThemeContext');
vi.mock('../../../utils/icon-path');

describe('Logo', () => {
  const mockGetIconPath = vi.mocked(iconPathUtils.getIconPath);
  const mockUseTheme = vi.mocked(ThemeContext.useTheme);

  beforeEach(() => {
    vi.clearAllMocks();
    celebration.event = null;
  });

  it('should render logo with correct theme', () => {
    const mockLogoName = 'chat-logo-dark.svg';
    const mockIconPath = '/api/themes/icon?iconName=chat-logo-dark.svg';

    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      currentThemeLogo: mockLogoName,
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });

    mockGetIconPath.mockReturnValue(mockIconPath);

    const { container } = render(<Logo />);

    const logo = screen.getByLabelText(ChatI18nKeys.Logo);
    /* This is a decorative background-image span with no accessible role
       or text; asserting its inline style/class is CSS-level behavior with
       no semantic query equivalent. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const logoImage = container.querySelector('span.desktop\\:block');
    expect(logo).toBeTruthy();
    expect(logoImage).toBeTruthy();
    expect((logoImage as HTMLElement).style.backgroundImage).toBe(
      `url(${mockIconPath})`,
    );
    expect(mockGetIconPath).toHaveBeenCalledWith(mockLogoName);
  });

  it('replaces the existing mobile icon and restores it when the event is disabled', () => {
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      currentThemeFavicon: 'favicon.svg',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });
    mockGetIconPath.mockReturnValue('/theme/favicon.svg');
    celebration.event = { iconUrl: '/events/test-icon.svg' };
    const { rerender } = render(<Logo />);
    /* The existing icon is a decorative CSS background inside the logo link. */
    // eslint-disable-next-line testing-library/no-node-access
    const icon = screen.getByRole('link').firstElementChild as HTMLElement;
    expect(icon.style.backgroundImage).toContain('/events/test-icon.svg');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    celebration.event = null;
    /* The mocked hook has no React subscription; remount to apply its value. */
    rerender(<Logo key="normal" />);
    const restoredLink = screen.getByRole('link');
    // eslint-disable-next-line testing-library/no-node-access
    const restoredIcon = restoredLink.firstElementChild as HTMLElement;
    expect(restoredIcon.style.backgroundImage).toContain('/theme/favicon.svg');
  });

  it('should return null when logo is not available', () => {
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      currentThemeLogo: undefined,
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });

    const { container } = render(<Logo />);
    expect(container.innerHTML).toBe('');
  });

  it('should update logo when theme changes', () => {
    const mockLightLogo = 'chat-logo-light.svg';
    const mockLightPath = '/api/themes/icon?iconName=chat-logo-light.svg';

    mockUseTheme.mockReturnValue({
      currentTheme: 'light',
      selectedTheme: 'light',
      currentThemeLogo: mockLightLogo,
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });

    mockGetIconPath.mockReturnValue(mockLightPath);

    const { container } = render(<Logo />);

    /* This is a decorative background-image span with no accessible role
       or text; asserting its inline style/class is CSS-level behavior with
       no semantic query equivalent. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const logoImage = container.querySelector('span.desktop\\:block');
    expect(logoImage).toBeTruthy();
    expect((logoImage as HTMLElement).style.backgroundImage).toBe(
      `url(${mockLightPath})`,
    );
    expect(mockGetIconPath).toHaveBeenCalledWith(mockLightLogo);
  });

  it('should render as a link with correct href', () => {
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      currentThemeLogo: 'logo.svg',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });

    mockGetIconPath.mockReturnValue('/api/themes/icon?iconName=logo.svg');

    render(<Logo />);

    const logo = screen.getByLabelText(ChatI18nKeys.Logo);
    expect((logo as HTMLElement).getAttribute('href')).toBe('/');
  });

  it('should apply correct CSS classes', () => {
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      currentThemeLogo: 'logo.svg',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });

    mockGetIconPath.mockReturnValue('/api/themes/icon?iconName=logo.svg');

    const { container } = render(<Logo />);

    /* This is a decorative background-image span with no accessible role
       or text; asserting its inline style/class is CSS-level behavior with
       no semantic query equivalent. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const logoImage = container.querySelector('span.desktop\\:block');
    expect(logoImage).toBeTruthy();
    expect((logoImage as HTMLElement).classList.contains('min-w-[125px]')).toBe(
      true,
    );
    expect((logoImage as HTMLElement).classList.contains('bg-contain')).toBe(
      true,
    );
    expect((logoImage as HTMLElement).classList.contains('bg-right')).toBe(
      true,
    );
    expect((logoImage as HTMLElement).classList.contains('bg-no-repeat')).toBe(
      true,
    );
  });
});
