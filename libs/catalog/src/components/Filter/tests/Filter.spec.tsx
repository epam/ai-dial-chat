import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Filter } from '../Filter';

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
  DialLinkButton: ({
    label,
    className,
  }: {
    label: string;
    className?: string;
    iconAfter?: React.ReactNode;
  }) => <button className={className}>{label}</button>,
}));

vi.mock('@tabler/icons-react', () => ({ IconChevronDown: () => null }));
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

  it('renders the My Apps checkbox', () => {
    renderFilter();
    expect(screen.getByLabelText('My Apps')).toBeTruthy();
  });

  it('renders topic checkboxes alphabetically when values are provided', () => {
    renderFilter({ values: new Set(['Vision', 'Code']) });
    const checkboxes = screen.getAllByRole('checkbox');
    // index 0: My Apps; 1: Code (alpha first); 2: Vision
    expect(checkboxes[1].id).toBe('filter-topic-Code');
    expect(checkboxes[2].id).toBe('filter-topic-Vision');
  });

  it('does not render Topics section when values is undefined', () => {
    renderFilter();
    expect(screen.queryByText('Topics')).toBeNull();
  });

  it('calls onChange with topic added when an unchecked topic is clicked', async () => {
    const onChange = vi.fn();
    renderFilter({ values: new Set(['Vision']), onChange });
    await userEvent.click(screen.getByLabelText('Vision'));
    expect(onChange).toHaveBeenCalledWith(new Set(['Vision']));
  });

  it('calls onChange with topic removed when a checked topic is clicked', async () => {
    const onChange = vi.fn();
    renderFilter({
      values: new Set(['Vision']),
      checked: new Set(['Vision']),
      onChange,
    });
    await userEvent.click(screen.getByLabelText('Vision'));
    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it('shows myAppsLabel as button label when only My Apps is active', () => {
    renderFilter({ isMyAppsActive: true, myAppsLabel: 'My Apps' });
    expect(screen.getByRole('button', { name: 'My Apps' })).toBeTruthy();
  });

  it('shows topic count label when only topics are active', () => {
    renderFilter({
      checked: new Set(['Vision']),
      values: new Set(['Vision', 'Code']),
      defaultLabel: 'From',
    });
    expect(screen.getByRole('button', { name: 'From: 1 of 2' })).toBeTruthy();
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
    expect(btn?.className).toContain('activeLabel');
  });

  it('does not apply active CSS class when no filter is on', () => {
    const { container } = renderFilter();
    const btn = container.querySelector('button');
    expect(btn?.className ?? '').not.toContain('activeLabel');
  });
});
