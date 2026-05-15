import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AriaAttributes } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Navigation from '../Navigation';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
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

  it('renders a Catalog button', () => {
    renderNavigation();
    expect(
      screen.getByRole('button', { name: 'navigation.catalog' }),
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

  it('does not mark Catalog as active on the / route', () => {
    renderNavigation('/');
    expect(
      screen
        .getByRole('button', { name: 'navigation.catalog' })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('marks Catalog as active on the /catalog route', () => {
    renderNavigation('/catalog');
    expect(
      screen
        .getByRole('button', { name: 'navigation.catalog' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('does not mark Home as active on the /catalog route', () => {
    renderNavigation('/catalog');
    expect(
      screen
        .getByRole('button', { name: 'navigation.home' })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('navigates to /catalog when Catalog button is clicked', async () => {
    const user = userEvent.setup();
    renderNavigation('/');
    await user.click(
      screen.getByRole('button', { name: 'navigation.catalog' }),
    );
    expect(
      screen
        .getByRole('button', { name: 'navigation.catalog' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});
