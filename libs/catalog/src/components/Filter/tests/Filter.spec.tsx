import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Filter } from '../Filter';

vi.mock('../Filter.module.scss', () => ({
  default: {
    filterBtn: 'filterBtn',
    filterBtnActive: 'filterBtnActive',
    overlay: 'overlay',
    row: 'row',
    rowChecked: 'rowChecked',
    checkbox: 'checkbox',
    checkboxChecked: 'checkboxChecked',
    rowLabel: 'rowLabel',
    divider: 'divider',
    sectionLabel: 'sectionLabel',
    topicsList: 'topicsList',
    footer: 'footer',
    applyBtn: 'applyBtn',
    filterBtnFunnel: 'filterBtnFunnel',
    filterBtnLabel: 'filterBtnLabel',
    filterBtnChevron: 'filterBtnChevron',
    filterBtnChevronOpen: 'filterBtnChevronOpen',
  },
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16 },
  DialDropdown: ({
    children,
    renderOverlay,
  }: {
    children: React.ReactNode;
    renderOverlay?: () => React.ReactNode;
    matchReferenceWidth?: boolean;
  }) => (
    <div>
      {children}
      {renderOverlay?.()}
    </div>
  ),
  DialCheckbox: ({
    id,
    label,
    checked,
    onChange,
  }: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (v: boolean | undefined) => void;
  }) => (
    <label htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={() => onChange(!checked)}
      />
      {label}
    </label>
  ),
}));

vi.mock('@epam/ai-dial-kit', () => ({
  GhostButton: ({
    label,
    className,
  }: {
    label: string;
    className?: string;
    iconBefore?: React.ReactNode;
    iconAfter?: React.ReactNode;
  }) => <button className={className}>{label}</button>,
  PrimaryButton: ({
    label,
    className,
    onClick,
  }: {
    label: string;
    className?: string;
    onClick?: () => void;
  }) => (
    <button className={className} onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconChevronDown: () => null,
  IconFilter: () => null,
}));
vi.mock('@epam/ai-dial-chat-shared', () => ({
  mergeClasses: (...args: (string | undefined)[]) =>
    args.filter(Boolean).join(' '),
}));

const renderFilter = (props?: Partial<React.ComponentProps<typeof Filter>>) =>
  render(<Filter checked={new Set()} onChange={vi.fn()} {...props} />);

describe('Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the My checkbox', () => {
    renderFilter();
    expect(screen.getByRole('menuitemcheckbox', { name: 'My' })).toBeTruthy();
  });

  it('renders topic checkboxes alphabetically when values are provided', () => {
    renderFilter({ values: new Set(['Vision', 'Code']) });
    const checkboxes = screen.getAllByRole('menuitemcheckbox');
    // index 0: My; 1: Code (alpha first); 2: Vision
    expect(checkboxes[1].textContent).toContain('Code');
    expect(checkboxes[2].textContent).toContain('Vision');
  });

  it('does not render Topics section when values is undefined', () => {
    renderFilter();
    expect(screen.queryByText('Topics')).toBeNull();
  });

  it('calls onChange with topic added when an unchecked topic is clicked', async () => {
    const onChange = vi.fn();
    renderFilter({ values: new Set(['Vision']), onChange });
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Vision' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith(new Set(['Vision']));
  });

  it('calls onChange with topic removed when a checked topic is clicked', async () => {
    const onChange = vi.fn();
    renderFilter({
      values: new Set(['Vision']),
      checked: new Set(['Vision']),
      onChange,
    });
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Vision' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it('shows myAppsLabel as button label when only My Apps is active', () => {
    renderFilter({ isMyAppsActive: true, myAppsLabel: 'My Apps' });
    expect(screen.getByRole('button', { name: 'My Apps' })).toBeTruthy();
  });

  it('shows topic count label when only topics are active', () => {
    renderFilter({
      checked: new Set(['Vision']),
      values: new Set(['Vision', 'Code', 'Images']),
      defaultLabel: 'From',
    });
    expect(screen.getByRole('button', { name: 'From: 1 of 3' })).toBeTruthy();
  });

  it('shows combined label when both My Apps and topics are active', () => {
    renderFilter({
      isMyAppsActive: true,
      checked: new Set(['Vision', 'Code']),
      myAppsLabel: 'My Apps',
    });
    expect(screen.getByRole('button', { name: 'My Apps · 2' })).toBeTruthy();
  });

  it('applies active CSS class to trigger when any filter is on', () => {
    const { container } = renderFilter({ isMyAppsActive: true });
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('filterBtnActive');
  });

  it('does not apply active CSS class when no filter is on', () => {
    const { container } = renderFilter();
    const btn = container.querySelector('button');
    expect(btn?.className ?? '').not.toContain('filterBtnActive');
  });

  it('renders the Apply button', () => {
    renderFilter();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
  });
});
