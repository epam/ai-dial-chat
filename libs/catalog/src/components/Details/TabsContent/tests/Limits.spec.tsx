import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LimitsTab } from '../Limits';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard' },
  ProgressBar: ({
    value,
    max,
    size,
    'aria-label': ariaLabel,
  }: {
    value: number;
    max?: number;
    size?: string;
    'aria-label'?: string;
  }) => (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemax={max}
      data-size={size}
    />
  ),
}));

describe('LimitsTab', () => {
  it('renders limit rows with progress bars and formatted values', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Tokens per day',
              used: 12,
              total: 20,
              valueLabel: '12 / 20',
              ariaLabel: 'Tokens per day usage',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Tokens per day')).toBeTruthy();
    expect(screen.getByText('12 / 20')).toBeTruthy();

    const progress = screen.getByRole('progressbar', {
      name: 'Tokens per day usage',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('12');
    expect(progress.getAttribute('aria-valuemax')).toBe('20');
    expect(progress.getAttribute('data-size')).toBe('standard');
  });

  it('renders nothing without limit rows', () => {
    const { container } = render(<LimitsTab limits={{ rows: [] }} />);

    // Component renders null; no semantic query can assert total absence of output.
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });

  it('renders a progress bar for unlimited rows', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Cost per week',
              used: 0.119012,
              total: 9223372036854776000,
              isUnlimited: true,
              valueLabel: 'Unlimited',
              ariaLabel: 'Cost per week: Unlimited',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Cost per week')).toBeTruthy();
    expect(screen.getByText('Unlimited')).toBeTruthy();

    const progress = screen.getByRole('progressbar', {
      name: 'Cost per week: Unlimited',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('0.119012');
    expect(progress.getAttribute('aria-valuemax')).toBe('9223372036854776000');
  });
});
