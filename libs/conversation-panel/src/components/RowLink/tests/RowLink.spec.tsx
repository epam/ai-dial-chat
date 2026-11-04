import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RowLink } from '../RowLink';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  Button: ({
    label,
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
    onClick,
    tabIndex,
    className,
  }: {
    label?: ReactNode;
    'aria-label'?: string;
    'aria-current'?: 'page';
    onClick?: () => void;
    tabIndex?: number;
    className?: string;
  }) => (
    <button
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={onClick}
      tabIndex={tabIndex}
      className={className}
    >
      {label}
    </button>
  ),
}));

describe('RowLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('makes the link the tab stop and calls onSelect instead of navigating when href is set', async () => {
    const onSelect = vi.fn();
    render(
      <RowLink
        href="/projects/q4"
        onSelect={onSelect}
        label="q4"
        aria-label="Open q4"
        aria-current="page"
        className="row"
      />,
    );

    const link = screen.getByRole('link', { name: 'Open q4' });
    const button = screen.getByRole('button', { name: 'Open q4' });
    expect(link.getAttribute('href')).toBe('/projects/q4');
    expect(button.tabIndex).toBe(-1);
    expect(button.getAttribute('aria-current')).toBe('page');
    expect(button.className).toBe('row');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('makes the button the control when href is absent', async () => {
    const onSelect = vi.fn();
    render(<RowLink onSelect={onSelect} label="q4" aria-label="Open q4" />);

    expect(screen.queryByRole('link')).toBeNull();
    const button = screen.getByRole('button', { name: 'Open q4' });
    expect(button.hasAttribute('tabindex')).toBe(false);

    await userEvent.click(button);

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
