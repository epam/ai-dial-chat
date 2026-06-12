import { render, screen } from '@testing-library/react';
import type { AriaAttributes } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NavigationI18nKeys } from '../../../constants/translation-keys';
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
    expect(nav?.getAttribute('aria-label')).toBe(NavigationI18nKeys.AriaLabel);
  });

  it('renders a Home button', () => {
    renderNavigation();
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.Home }),
    ).toBeTruthy();
  });

  it('marks Home as active on the / route', () => {
    renderNavigation('/');
    expect(
      screen
        .getByRole('button', { name: NavigationI18nKeys.Home })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});
