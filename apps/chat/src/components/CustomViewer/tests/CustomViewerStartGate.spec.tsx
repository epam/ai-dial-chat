import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomViewerI18nKeys } from '../../../constants/translation-keys';
import CustomViewerStartGate from '../CustomViewerStartGate';

describe('CustomViewerStartGate', () => {
  const onStart = vi.fn();

  const renderGate = () =>
    render(<CustomViewerStartGate viewerTitle="Explorer" onStart={onStart} />);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the start button', () => {
    renderGate();

    expect(
      screen.getByRole('button', { name: CustomViewerI18nKeys.StartWorking }),
    ).toBeTruthy();
  });

  it('calls onStart when the button is clicked', async () => {
    renderGate();

    await userEvent.click(
      screen.getByRole('button', { name: CustomViewerI18nKeys.StartWorking }),
    );

    expect(onStart).toHaveBeenCalledOnce();
  });

  it('calls onStart when the button is activated with the keyboard', async () => {
    renderGate();

    screen
      .getByRole('button', { name: CustomViewerI18nKeys.StartWorking })
      .focus();
    await userEvent.keyboard('{Enter}');

    expect(onStart).toHaveBeenCalledOnce();
  });

  it('mirrors the directional play icon in RTL', () => {
    const { container } = renderGate();

    /* CSS-level check: no semantic query reaches the icon's class list. */
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'rtl:scale-x-[-1]',
    );
  });
});
