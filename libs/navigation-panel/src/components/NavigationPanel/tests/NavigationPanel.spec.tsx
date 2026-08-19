import { render, screen } from '@testing-library/react';
import type { AriaAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { NavigationPanelItem } from '../../../models/navigation-item';
import { NavigationPanel } from '../NavigationPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  IconButton: ({
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
    icon,
  }: {
    'aria-label': string;
    'aria-current'?: AriaAttributes['aria-current'];
    icon: ReactNode;
  }) => (
    <button type="button" aria-label={ariaLabel} aria-current={ariaCurrent}>
      {icon}
    </button>
  ),
}));

const HomeIcon = () => <svg />;
const CatalogIcon = () => <svg />;

const items: NavigationPanelItem[] = [
  { id: '/', label: 'Home', icon: HomeIcon, href: '/', isActive: true },
  {
    id: '/catalog',
    label: 'Catalog',
    icon: CatalogIcon,
    href: '/catalog',
  },
];

const labels = { ariaLabel: 'Primary' };

describe('NavigationPanel', () => {
  it('renders the nav landmark with the given accessible name', () => {
    render(<NavigationPanel items={items} labels={labels} />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  });

  it('renders one labelled button per item', () => {
    render(<NavigationPanel items={items} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeTruthy();
  });

  it('marks only the active item with aria-current="page"', () => {
    render(<NavigationPanel items={items} labels={labels} />);
    expect(
      screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen
        .getByRole('button', { name: 'Catalog' })
        .hasAttribute('aria-current'),
    ).toBe(false);
  });

  it('wraps items in plain anchors carrying their href by default', () => {
    render(<NavigationPanel items={items} labels={labels} />);
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/catalog']);
  });

  it('delegates link rendering to renderLink when provided', () => {
    render(
      <NavigationPanel
        items={items}
        labels={labels}
        renderLink={(item, children) => (
          <a href={`/app${item.href ?? ''}`} className="contents">
            {children}
          </a>
        )}
      />,
    );
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/app/', '/app/catalog']);
  });

  it('renders the logo link when a logo is supplied', () => {
    render(
      <NavigationPanel
        items={items}
        labels={labels}
        logo={{ iconUrl: '/icon.svg', ariaLabel: 'Brand' }}
      />,
    );
    const logo = screen.getByRole('link', { name: 'Brand' });
    expect(logo.getAttribute('href')).toBe('/');
  });

  it('omits the logo link when no logo is supplied', () => {
    render(<NavigationPanel items={items} labels={labels} />);
    expect(screen.queryByRole('link', { name: 'Brand' })).toBeNull();
  });

  it('renders the footer slot', () => {
    render(
      <NavigationPanel
        items={items}
        labels={labels}
        footer={<span>footer slot</span>}
      />,
    );
    expect(screen.getByText('footer slot')).toBeTruthy();
  });
});
