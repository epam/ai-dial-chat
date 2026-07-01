import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogViewMode } from '../../../types/view-mode';
import { Toolbar } from '../Toolbar';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ButtonAppearance: { Solid: 'solid', Ghost: 'ghost' },
  ButtonVariant: { Primary: 'primary' },
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
  DialLinkButton: ({
    label,
  }: {
    label: string;
    className?: string;
    iconAfter?: React.ReactNode;
  }) => <button>{label}</button>,
  DialDangerButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
    iconBefore?: React.ReactNode;
    className?: string;
    size?: string;
    appearance?: string;
  }) => <button onClick={onClick}>{label}</button>,
  DialIcon: () => null,
  DialPrimaryIconButton: ({
    onClick,
  }: {
    onClick: () => void;
    icon?: React.ReactNode;
    size?: string;
    appearance?: string;
  }) => <button aria-label="view-mode" onClick={onClick} />,
  DialButtonDropdown: ({
    label,
  }: {
    label: string;
    variant?: string;
    appearance?: string;
    items?: unknown[];
  }) => <button aria-label="sort">{label}</button>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconFilter: () => null,
  IconX: () => null,
  IconChevronDown: () => null,
  IconLayoutCards: () => null,
  IconLayoutList: () => null,
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
      isAnyFilterActive={false}
      onClearFilters={vi.fn()}
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

  it('does not render Clear all button when isAnyFilterActive is false', () => {
    renderToolbar({ isAnyFilterActive: false, clearAllLabel: 'Clear all' });
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });

  it('renders Clear all button when isAnyFilterActive is true', () => {
    renderToolbar({ isAnyFilterActive: true, clearAllLabel: 'Clear all' });
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeTruthy();
  });

  it('calls onClearFilters when Clear all is clicked', async () => {
    const onClearFilters = vi.fn();
    renderToolbar({
      isAnyFilterActive: true,
      clearAllLabel: 'Clear all',
      onClearFilters,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
