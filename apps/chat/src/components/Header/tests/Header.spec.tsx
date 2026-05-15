import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ThemeContext from '../../../context/ThemeContext';
import Header from '../Header';

// Mock the ThemeContext for Logo component
vi.mock('../../context/ThemeContext');
vi.mock('../../utils/icon-path');

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

  it('should render Header component', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });

  it('should render Logo component inside Header', () => {
    const { container } = render(<Header />);
    // Logo renders as an <a> element with aria-label="logo"
    const logo = container.querySelector('a[aria-label="logo"]');
    expect(logo).toBeTruthy();
  });

  it('should apply correct styling classes', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');

    expect(header?.classList.contains('relative')).toBe(true);
    expect(header?.classList.contains('z-30')).toBe(true);
    expect(header?.classList.contains('flex')).toBe(true);
    expect(header?.classList.contains('min-h-[49px]')).toBe(true);
    expect(header?.classList.contains('w-full')).toBe(true);
  });

  it('should match snapshot', () => {
    const { container } = render(<Header />);
    expect(container).toMatchSnapshot();
  });
});
