import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InitialsAvatar } from '../InitialsAvatar';

const renderAvatar = (
  props?: Partial<{ name: string; size: number; className: string }>,
) => render(<InitialsAvatar name="My App" size={36} {...props} />);

describe('InitialsAvatar', () => {
  it('renders the initials derived from name', () => {
    renderAvatar({ name: 'My App' });
    expect(screen.getByText('MA')).toBeTruthy();
  });

  it('renders "?" when name is empty', () => {
    renderAvatar({ name: '' });
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('sets aria-hidden on the root element', () => {
    const { container } = renderAvatar();
    expect(
      (container.firstChild as HTMLElement).getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('applies a non-empty background colour as an inline style', () => {
    const { container } = renderAvatar({ name: 'Alpha' });
    expect(
      (container.firstChild as HTMLElement).style.backgroundColor,
    ).not.toBe('');
  });

  it('applies size as width and height', () => {
    const { container } = renderAvatar({ size: 48 });
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('48px');
    expect(el.style.height).toBe('48px');
  });

  it('forwards className to the root element', () => {
    const { container } = renderAvatar({ className: 'shrink-0' });
    expect((container.firstChild as HTMLElement).className).toContain(
      'shrink-0',
    );
  });
});
