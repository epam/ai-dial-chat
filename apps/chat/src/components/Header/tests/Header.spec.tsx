import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatI18nKeys } from '../../../constants/translation-keys';
import * as ThemeContext from '../../../context/ThemeContext';
import Header from '../Header';

vi.mock('../../../context/ThemeContext');
vi.mock('../../../utils/icon-path');

describe('Header', () => {
  const mockUseTheme = vi.mocked(ThemeContext.useTheme);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      currentThemeLogo: 'logo.svg',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('renders Header component', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });

  it('renders Logo component inside Header', () => {
    render(<Header />);
    const logo = screen.getByLabelText(ChatI18nKeys.Logo);
    expect(logo).toBeTruthy();
  });

  it('applies expected container classes', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');

    expect(header?.classList.contains('relative')).toBe(true);
    expect(header?.classList.contains('z-30')).toBe(true);
    expect(header?.classList.contains('flex')).toBe(true);
    expect(header?.classList.contains('min-h-[49px]')).toBe(true);
    expect(header?.classList.contains('w-full')).toBe(true);
  });
});
