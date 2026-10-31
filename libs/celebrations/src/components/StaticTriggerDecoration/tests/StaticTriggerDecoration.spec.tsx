/* The trigger image is decorative and has no role; inspect it directly. */
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaticTriggerDecoration } from '../StaticTriggerDecoration';

const onActivate = vi.fn();

const renderTrigger = (label?: string, imageUrl = '/assets/trigger') =>
  render(
    <StaticTriggerDecoration
      onActivate={onActivate}
      imageUrl={imageUrl}
      label={label}
    />,
  );

describe('StaticTriggerDecoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a native button named by the resolved label', () => {
    renderTrigger('Celebrate ten years');
    const button = screen.getByRole('button', { name: 'Celebrate ten years' });
    expect(button.getAttribute('type')).toBe('button');
  });

  it('falls back to the English default name when the label is empty', () => {
    renderTrigger('');
    expect(
      screen.getByRole('button', { name: 'Play celebration' }),
    ).toBeTruthy();
  });

  it('hides its decorative image from assistive technology', () => {
    renderTrigger('Celebrate');
    const image = screen.getByRole('button', {
      name: 'Celebrate',
    }).firstElementChild;
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('aria-hidden')).toBe('true');
    expect(image?.getAttribute('src')).toBe('/assets/trigger');
  });

  it('calls onActivate on click', async () => {
    renderTrigger('Celebrate');
    await userEvent.click(screen.getByRole('button', { name: 'Celebrate' }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it.each(['{Enter}', ' '])('calls onActivate on %s', async (key) => {
    renderTrigger('Celebrate');
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Celebrate' }),
    );
    await userEvent.keyboard(key);
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('renders no image when the URL is unavailable', () => {
    render(
      <StaticTriggerDecoration onActivate={onActivate} label="Celebrate" />,
    );
    expect(
      screen.getByRole('button', { name: 'Celebrate' }).childElementCount,
    ).toBe(0);
  });
});
