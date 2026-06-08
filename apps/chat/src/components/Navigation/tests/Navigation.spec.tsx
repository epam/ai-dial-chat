import { render, screen } from '@testing-library/react';
import type { AriaAttributes } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Navigation from '../Navigation';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: {
    LG: 24,
  },
  DialGhostIconButton: ({
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
    onClick,
  }: {
    'aria-label': string;
    'aria-current'?: AriaAttributes['aria-current'];
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={onClick}
    />
  ),
}));

vi.mock('../UserMenu', () => ({
  default: () => <div>User menu</div>,
}));

const renderNavigation = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navigation />
    </MemoryRouter>,
  );

describe('Navigation', () => {
  it('renders the nav landmark with aria-label', () => {
    const { container } = renderNavigation();
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav?.getAttribute('aria-label')).toBe('navigation.ariaLabel');
  });

  it('renders a Home button', () => {
    renderNavigation();
    expect(
      screen.getByRole('button', { name: 'navigation.home' }),
    ).toBeTruthy();
  });

  it('marks Home as active on the / route', () => {
    renderNavigation('/');
    expect(
      screen
        .getByRole('button', { name: 'navigation.home' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});
