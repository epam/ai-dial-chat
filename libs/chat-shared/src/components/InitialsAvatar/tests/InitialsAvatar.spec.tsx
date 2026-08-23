import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pickAvatarColor } from '../../../utils/avatar-color';
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
    /*
     * Root is aria-hidden with no accessible role/text, so a CSS-level
     * container query is the only way to reach it (allowed for CSS-level
     * assertions per .claude/rules/spec.md).
     */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const el = container.querySelector('div') as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the palette colours as CSS custom properties', () => {
    const { container } = renderAvatar({ name: 'Alpha' });
    const { background, foreground } = pickAvatarColor('Alpha');
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- root is aria-hidden; CSS custom properties have no semantic query
    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.getPropertyValue('--ia-bg')).toBe(background);
    expect(el.style.getPropertyValue('--ia-fg')).toBe(foreground);
  });

  it('applies size as width and height', () => {
    const { container } = renderAvatar({ size: 48 });
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- root is aria-hidden; inline style has no semantic query
    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.width).toBe('48px');
    expect(el.style.height).toBe('48px');
  });

  it('forwards className to the root element', () => {
    const { container } = renderAvatar({ className: 'shrink-0' });
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- root is aria-hidden; className has no semantic query
    const el = container.querySelector('div') as HTMLElement;
    expect(el.className).toContain('shrink-0');
  });
});
