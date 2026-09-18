import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_CLASS } from '../../../constants/public-class-names';
import { CatalogViewMode } from '../../../types/view-mode';
import { Toolbar } from '../Toolbar';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  DialSearch: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  EllipsisTooltip: ({
    text,
    className,
  }: {
    text: unknown;
    className?: string;
  }) => <span className={className}>{text as string}</span>,
  Dropdown: ({
    children,
    renderOverlay,
  }: {
    children: React.ReactNode;
    renderOverlay?: () => React.ReactNode;
    matchReferenceWidth?: boolean;
  }) => (
    <>
      {children}
      {renderOverlay?.()}
    </>
  ),
  DialCheckbox: ({ label }: { label: string }) => <span>{label}</span>,
  DialIcon: () => null,
  GhostButton: ({
    icon,
    onClick,
  }: {
    icon: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{icon}</button>,
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconFilter: () => null,
  IconX: () => null,
  IconChevronDown: () => null,
  IconLayoutGrid: () => null,
  IconLayoutList: () => null,
  IconSearch: () => null,
}));

const renderToolbar = (props?: Partial<React.ComponentProps<typeof Toolbar>>) =>
  render(
    <Toolbar
      query=""
      onQueryChange={vi.fn()}
      viewMode={CatalogViewMode.Grid}
      onViewModeChange={vi.fn()}
      {...props}
    />,
  );

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section title', () => {
    renderToolbar({ title: 'Browse' });
    expect(screen.getByText('Browse')).toBeTruthy();
  });

  it('renders browseHeaderRenderer instead of the title/count when provided', () => {
    renderToolbar({
      title: 'Browse',
      totalCount: 5,
      browseHeaderRenderer: (
        <nav aria-label="breadcrumb">All entities &gt; Org</nav>
      ),
    });

    expect(screen.getByLabelText('breadcrumb')).toBeTruthy();
    expect(screen.queryByText('Browse')).toBeNull();
  });
});

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

describe('Toolbar — public class names', () => {
  it('stamps the toolbar root', () => {
    renderToolbar();

    expect(
      closestWithClass(screen.getByText('Browse'), CATALOG_CLASS.toolbar),
    ).toBeTruthy();
  });
});
