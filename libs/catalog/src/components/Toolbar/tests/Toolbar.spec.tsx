import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogViewMode } from '../../../types/view-mode';
import { Toolbar } from '../Toolbar';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Regular: 'regular' },
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
  DialEllipsisTooltip: ({
    text,
    className,
  }: {
    text: unknown;
    className?: string;
  }) => <span className={className}>{text as string}</span>,
  DialDropdown: ({
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
  DialButtonDropdown: ({
    label,
  }: {
    label: string;
    variant?: string;
    appearance?: string;
    items?: unknown[];
  }) => <button aria-label="sort">{label}</button>,
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

vi.mock('@epam/ai-dial-chat-shared', () => ({
  mergeClasses: (...args: (string | undefined)[]) =>
    args.filter(Boolean).join(' '),
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
});
