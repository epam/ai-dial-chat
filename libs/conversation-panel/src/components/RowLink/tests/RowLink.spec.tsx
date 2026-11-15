import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RowLink } from '../RowLink';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  Button: ({
    label,
    href,
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
    onClick,
    tabIndex,
    className,
  }: {
    label?: ReactNode;
    href?: string;
    'aria-label'?: string;
    'aria-current'?: 'page';
    onClick?: MouseEventHandler;
    tabIndex?: number;
    className?: string;
  }) =>
    href !== undefined ? (
      <a
        href={href}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        onClick={onClick}
        tabIndex={tabIndex}
        className={className}
      >
        {label}
      </a>
    ) : (
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

  it('renders one link that stays in the tab order and calls onSelect instead of navigating when href is set', () => {
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
    expect(screen.queryByRole('button')).toBeNull();
    expect(link.getAttribute('href')).toBe('/projects/q4');
    expect(link.hasAttribute('tabindex')).toBe(false);
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.className).toBe('row');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])(
    'leaves a %s click to the browser and does not call onSelect',
    (_name, init) => {
      const onSelect = vi.fn();
      render(
        <RowLink href="/projects/q4" onSelect={onSelect} aria-label="q4" />,
      );

      const link = screen.getByRole('link', { name: 'q4' });
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ...init,
      });
      link.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(false);
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  it('makes the button the control when href is absent', async () => {
    const onSelect = vi.fn();
    render(<RowLink onSelect={onSelect} label="q4" aria-label="Open q4" />);

    expect(screen.queryByRole('link')).toBeNull();
    const button = screen.getByRole('button', { name: 'Open q4' });
    expect(button.hasAttribute('tabindex')).toBe(false);

    await userEvent.click(button);

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('calls onSelect for a Ctrl-click when href is absent, since there is no URL to open in a new tab', () => {
    const onSelect = vi.fn();
    render(<RowLink onSelect={onSelect} label="q4" aria-label="Open q4" />);

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    screen.getByRole('button', { name: 'Open q4' }).dispatchEvent(click);

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
