import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NAVIGATION_PANEL_CLASS } from '../../../constants/public-class-names';
import type { NavigationPanelItem } from '../../../models/navigation-item';
import { NavigationSidebarVariant } from '../../../types/navigation-sidebar-variant';
import { NavigationSidebar } from '../NavigationSidebar';

vi.mock('@epam/ai-dial-chat-shared', () => ({
  buildCssVars: () => ({}),
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DIAL_KIT_ICON_STROKE: 1.5,
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  GhostButton: ({
    label,
    iconBefore,
    onClick,
    'aria-current': ariaCurrent,
    className,
  }: {
    label?: React.ReactNode;
    iconBefore?: React.ReactNode;
    onClick?: () => void;
    'aria-current'?: React.AriaAttributes['aria-current'];
    className?: string;
  }) => (
    <button onClick={onClick} aria-current={ariaCurrent} className={className}>
      {iconBefore}
      {label}
    </button>
  ),
  GhostIconButton: ({
    icon,
    onClick,
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    className,
  }: {
    icon?: React.ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
    'aria-current'?: React.AriaAttributes['aria-current'];
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={className}
    >
      {icon}
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconLayoutSidebar: ({ className }: { className?: string }) => (
    <span aria-hidden className={className}>
      sidebar-glyph
    </span>
  ),
  IconX: () => <span aria-hidden>close-glyph</span>,
}));

const Glyph = () => <span aria-hidden>glyph</span>;

const ITEMS: NavigationPanelItem[] = [
  { id: '/', label: 'New chat', icon: Glyph, href: '/', isActive: true },
  { id: '/catalog', label: 'Catalog', icon: Glyph, href: '/catalog' },
];

const LABELS = {
  ariaLabel: 'Main navigation',
  collapse: 'Collapse sidebar',
  expand: 'Expand sidebar',
};

const LOGO = {
  ariaLabel: 'Logo',
  logoUrl: 'https://example.com/logo.svg',
  iconUrl: 'https://example.com/icon.svg',
};

const renderSidebar = (
  props: Partial<React.ComponentProps<typeof NavigationSidebar>> = {},
) =>
  render(
    <NavigationSidebar
      items={ITEMS}
      labels={LABELS}
      isCollapsed={false}
      onToggleCollapse={vi.fn()}
      logo={LOGO}
      userMenu={<button>user-menu</button>}
      footerActions={<button>usage</button>}
      {...props}
    >
      <div>chats-content</div>
    </NavigationSidebar>,
  );

/* The slot wrapper has no role; its inert state is the contract under test. */
/* eslint-disable testing-library/no-node-access */
const getSlotWrapper = (): HTMLElement =>
  screen.getByText('chats-content').parentElement?.parentElement as HTMLElement;
/* eslint-enable testing-library/no-node-access */

describe('NavigationSidebar — RTL', () => {
  it('mirrors the toggle glyph under dir="rtl"', () => {
    renderSidebar();

    expect(screen.getByText('sidebar-glyph').className).toContain(
      'rtl:scale-x-[-1]',
    );
  });

  it('positions the item and footer padding with logical utilities only', () => {
    renderSidebar();

    expect(screen.getByRole('navigation').innerHTML).not.toMatch(
      /(?:^|[\s"])(?:ml|mr|pl|pr)-\d/,
    );
  });
});

describe('NavigationSidebar', () => {
  it('renders the landmark with the sidebar public class', () => {
    renderSidebar();

    expect(
      screen
        .getByRole('navigation', { name: 'Main navigation' })
        .classList.contains(NAVIGATION_PANEL_CLASS.sidebar),
    ).toBe(true);
    expect(
      screen
        .getByRole('navigation', { name: 'Main navigation' })
        .classList.contains(NAVIGATION_PANEL_CLASS.rail),
    ).toBe(false);
  });

  it('renders visible labels for every item when expanded', () => {
    renderSidebar();

    expect(screen.getByText('New chat')).toBeTruthy();
    expect(screen.getByText('Catalog')).toBeTruthy();
  });

  it('renders icon-only items named by their label when collapsed', () => {
    renderSidebar({ isCollapsed: true });

    expect(screen.getByRole('button', { name: 'New chat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeTruthy();
    expect(screen.queryByText('Catalog')).toBeNull();
  });

  it('marks only the active item as the current page', () => {
    renderSidebar();

    expect(
      screen
        .getByRole('button', { name: 'New chat' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen
        .getByRole('button', { name: 'Catalog' })
        .hasAttribute('aria-current'),
    ).toBe(false);
  });

  it('reports the toggle through aria-expanded and swaps its name', () => {
    const onToggleCollapse = vi.fn();
    const { rerender } = renderSidebar({ onToggleCollapse });

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.getAttribute('aria-controls')).toBe(
      screen.getByRole('navigation').id,
    );

    fireEvent.click(collapse);
    expect(onToggleCollapse).toHaveBeenCalledOnce();

    rerender(
      <NavigationSidebar
        items={ITEMS}
        labels={LABELS}
        isCollapsed
        onToggleCollapse={onToggleCollapse}
        logo={LOGO}
      />,
    );
    expect(
      screen
        .getByRole('button', { name: 'Expand sidebar' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('keeps keyboard focus on the toggle when the sidebar collapses', () => {
    const onToggleCollapse = vi.fn();
    const { rerender } = renderSidebar({ onToggleCollapse });
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    toggle.focus();

    rerender(
      <NavigationSidebar
        items={ITEMS}
        labels={LABELS}
        isCollapsed
        onToggleCollapse={onToggleCollapse}
        logo={LOGO}
      />,
    );

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBe(toggle);
    // eslint-disable-next-line testing-library/no-node-access -- focus is a property of the document, not of a queryable node
    expect(document.activeElement).toBe(toggle);
  });

  it('renders no toggle without a handler and keeps the logo link', () => {
    renderSidebar({ onToggleCollapse: undefined });

    expect(
      screen.queryByRole('button', { name: 'Collapse sidebar' }),
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Logo' }).getAttribute('href'),
    ).toBe('/');
  });

  it('keeps the children mounted but inert and hidden while collapsed', () => {
    const { rerender } = renderSidebar();
    const expandedWrapper = getSlotWrapper();
    expect(expandedWrapper.hasAttribute('inert')).toBe(false);

    rerender(
      <NavigationSidebar
        items={ITEMS}
        labels={LABELS}
        isCollapsed
        onToggleCollapse={vi.fn()}
      >
        <div>chats-content</div>
      </NavigationSidebar>,
    );

    const collapsedWrapper = getSlotWrapper();
    expect(collapsedWrapper.hasAttribute('inert')).toBe(true);
    expect(collapsedWrapper.className).toContain('invisible');
  });

  it('orders the footer user menu before the actions when expanded', () => {
    renderSidebar();

    const footerButtons = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => text === 'user-menu' || text === 'usage');
    expect(footerButtons).toEqual(['user-menu', 'usage']);
  });

  it('orders the footer actions before the user menu when collapsed', () => {
    renderSidebar({ isCollapsed: true });

    const footerButtons = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => text === 'user-menu' || text === 'usage');
    expect(footerButtons).toEqual(['usage', 'user-menu']);
  });

  it('wraps each item with the host link renderer', () => {
    const renderLink = vi.fn((item: NavigationPanelItem, children) => (
      <a href={`/x${item.id}`}>{children}</a>
    ));
    renderSidebar({ renderLink });

    expect(renderLink).toHaveBeenCalledTimes(ITEMS.length);
    expect(
      within(screen.getByRole('link', { name: /Catalog/ })).getByText(
        'Catalog',
      ),
    ).toBeTruthy();
  });

  it('hands a host with its own item markup every item, including ones without a target', () => {
    const items: NavigationPanelItem[] = [
      { id: 'chat', label: 'Chat', icon: Glyph, href: '/' },
      { id: 'projects', label: 'Projects', icon: Glyph },
    ];
    const renderLink = (item: NavigationPanelItem) =>
      item.href == null ? (
        <button type="button" disabled>
          {item.label}
        </button>
      ) : (
        <a href={item.href}>{item.label}</a>
      );
    renderSidebar({ items, renderLink });

    expect(screen.getByRole('link', { name: 'Chat' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Projects' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('keeps the same items when collapsed for a host that renders its own markup', () => {
    const items: NavigationPanelItem[] = [
      { id: 'costs', label: 'Costs', icon: Glyph, href: '/costs' },
    ];
    renderSidebar({
      items,
      isCollapsed: true,
      renderLink: (item) => <a href={item.href}>{item.label}</a>,
    });

    expect(screen.getByRole('link', { name: 'Costs' })).toBeTruthy();
  });

  describe('drawer variant', () => {
    const renderDrawer = (
      props: Partial<React.ComponentProps<typeof NavigationSidebar>> = {},
    ) =>
      renderSidebar({
        variant: NavigationSidebarVariant.Drawer,
        onToggleCollapse: undefined,
        onClose: vi.fn(),
        ...props,
      });

    it('renders a 320px landmark', () => {
      renderDrawer();

      expect(screen.getByRole('navigation').className).toContain('w-[320px]');
      expect(screen.getByRole('navigation').className).not.toContain(
        'w-[336px]',
      );
    });

    it('closes through its close button and renders no collapse toggle', () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledOnce();
      expect(
        screen.queryByRole('button', { name: 'Collapse sidebar' }),
      ).toBeNull();
    });

    it('names the close button from the label when one is given', () => {
      renderDrawer({ labels: { ...LABELS, close: 'Dismiss' } });

      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });

    it('renders no close button without a handler, and keeps the logo link', () => {
      renderDrawer({ onClose: undefined });

      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
      expect(screen.getByRole('link', { name: LOGO.ariaLabel })).toBeTruthy();
    });

    it('is shown, reachable and not translated by default', () => {
      renderDrawer();

      const drawer = screen.getByRole('navigation');
      expect(drawer.hasAttribute('inert')).toBe(false);
      expect(drawer.className).toContain('translate-x-0');
      expect(drawer.className).toContain('fixed');
    });

    it('slides out, hides and goes inert while closed', () => {
      renderDrawer({ isOpen: false });

      const drawer = screen.getByRole('navigation', { hidden: true });
      expect(drawer.hasAttribute('inert')).toBe(true);
      expect(drawer.className).toContain('invisible');
      expect(drawer.className).toContain('ltr:-translate-x-full');
      expect(drawer.className).toContain('rtl:translate-x-full');
    });

    it('takes the id the host gives it', () => {
      renderDrawer({ id: 'my-drawer' });

      expect(screen.getByRole('navigation').id).toBe('my-drawer');
    });

    it('closes on Escape pressed inside it', () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });

      fireEvent.keyDown(screen.getByRole('link', { name: LOGO.ariaLabel }), {
        key: 'Escape',
      });

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('moves focus in when it opens and back to the opener when it closes', () => {
      const renderWithOpener = (isOpen: boolean) => (
        <>
          <button>opener</button>
          <NavigationSidebar
            items={ITEMS}
            labels={LABELS}
            variant={NavigationSidebarVariant.Drawer}
            isOpen={isOpen}
          />
        </>
      );
      const { rerender } = render(renderWithOpener(false));
      const opener = screen.getByRole('button', { name: 'opener' });
      opener.focus();

      rerender(renderWithOpener(true));
      /* eslint-disable testing-library/no-node-access -- focus is a property of the document, not of a queryable node */
      expect(document.activeElement).toBe(screen.getByRole('navigation'));

      rerender(renderWithOpener(false));
      expect(document.activeElement).toBe(opener);
      /* eslint-enable testing-library/no-node-access */
    });

    it('leaves focus alone when it is open on mount', () => {
      render(
        <>
          <button>opener</button>
          <NavigationSidebar
            items={ITEMS}
            labels={LABELS}
            variant={NavigationSidebarVariant.Drawer}
          />
        </>,
      );
      const opener = screen.getByRole('button', { name: 'opener' });
      opener.focus();

      /* eslint-disable-next-line testing-library/no-node-access -- see above */
      expect(document.activeElement).toBe(opener);
    });

    it('ignores the collapsed state and keeps every item as a labelled row', () => {
      renderDrawer({ isCollapsed: true });

      expect(screen.getByRole('navigation').className).not.toContain(
        'w-[72px]',
      );
      expect(screen.getByText('Catalog')).toBeTruthy();
      expect(getSlotWrapper().hasAttribute('inert')).toBe(false);
    });
  });
});

describe('NavigationSidebar — public class names', () => {
  it('stamps every item, expanded and collapsed', () => {
    const { rerender } = renderSidebar();
    for (const name of ['New chat', 'Catalog']) {
      expect(screen.getByRole('button', { name }).classList).toContain(
        NAVIGATION_PANEL_CLASS.sidebarItem,
      );
    }

    rerender(
      <NavigationSidebar
        items={ITEMS}
        labels={LABELS}
        isCollapsed
        onToggleCollapse={vi.fn()}
      />,
    );

    for (const name of ['New chat', 'Catalog']) {
      expect(screen.getByRole('button', { name }).classList).toContain(
        NAVIGATION_PANEL_CLASS.sidebarItem,
      );
    }
  });

  it('stamps the footer that holds the user menu', () => {
    renderSidebar();

    /* The footer has no role; it is found as the parent of the user menu it
       holds, which the host passes. */
    /* eslint-disable testing-library/no-node-access -- see above */
    const footer = screen.getByRole('button', {
      name: 'user-menu',
    }).parentElement;
    /* eslint-enable testing-library/no-node-access */

    expect(footer?.classList).toContain(NAVIGATION_PANEL_CLASS.sidebarFooter);
  });
});

describe('NavigationSidebar — typography', () => {
  it('applies typography.fontClassName to item labels only', () => {
    renderSidebar({
      styles: { typography: { fontClassName: 'dial-tiny-text' } },
    });

    expect(screen.getByText('Catalog').classList).toContain('dial-tiny-text');
    expect(screen.getByRole('navigation').classList).not.toContain(
      'dial-tiny-text',
    );
  });

  it('defaults item labels to dial-small-text', () => {
    renderSidebar();

    expect(screen.getByText('Catalog').classList).toContain('dial-small-text');
  });
});
