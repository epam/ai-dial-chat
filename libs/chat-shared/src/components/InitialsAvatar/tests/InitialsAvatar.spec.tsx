import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InitialsAvatar } from '../InitialsAvatar';

const renderAvatar = (
  props?: Partial<{
    name: string;
    size: number;
    className: string;
    textClassName: string;
  }>,
) => render(<InitialsAvatar name="My App" size={36} {...props} />);

/*
 * The badge is aria-hidden and every assertion on it is CSS-level (classes,
 * inline size), so it is reached from its text node — allowed for CSS-level
 * assertions per .claude/rules/spec.md.
 */
const badgeOf = (initials: string) =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  screen.getByText(initials).parentElement as HTMLElement;

describe('InitialsAvatar', () => {
  it('renders the initials derived from name', () => {
    renderAvatar({ name: 'My App' });
    expect(screen.getByText('MA')).toBeTruthy();
  });

  it('renders "?" when name is empty', () => {
    renderAvatar({ name: '' });
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('hides the badge from assistive technology', () => {
    renderAvatar();
    expect(badgeOf('MA').getAttribute('aria-hidden')).toBe('true');
  });

  it('is a square badge, not a circle', () => {
    renderAvatar();
    expect(badgeOf('MA').className).toContain('rounded-md');
    expect(badgeOf('MA').className).not.toContain('rounded-full');
  });

  it('applies size as width and height, with the initials at 40% of it', () => {
    renderAvatar({ size: 48 });
    expect(badgeOf('MA').style.width).toBe('48px');
    expect(badgeOf('MA').style.height).toBe('48px');
    expect(badgeOf('MA').style.fontSize).toBe('19px');
  });

  it('lets textClassName replace the size-derived font size', () => {
    renderAvatar({ textClassName: '!text-lg' });
    expect(screen.getByText('MA').className).toContain('!text-lg');
    expect(badgeOf('MA').style.fontSize).toBe('');
  });

  it('forwards className to the root element', () => {
    renderAvatar({ className: 'shrink-0' });
    expect(badgeOf('MA').className).toContain('shrink-0');
  });
});
