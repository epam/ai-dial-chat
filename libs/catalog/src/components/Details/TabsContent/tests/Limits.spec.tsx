import { render, screen } from '@testing-library/react';
import { ReactNode, useId } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LimitsTab } from '../Limits';
import styles from '../Limits.module.scss';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard' },
  ProgressBar: ({
    value,
    max,
    size,
    className,
    labelProps,
    valueLabel,
    'aria-valuetext': ariaValueText,
  }: {
    value: number;
    max?: number;
    size?: string;
    className?: string;
    labelProps?: { label?: ReactNode };
    valueLabel?: ReactNode;
    'aria-valuetext'?: string;
  }) => {
    const labelId = useId();
    return (
      <div>
        <span id={labelId}>{labelProps?.label}</span>
        <div
          role="progressbar"
          className={className}
          aria-labelledby={labelId}
          aria-valuenow={value}
          aria-valuemax={max}
          aria-valuetext={ariaValueText}
          data-size={size}
        >
          {valueLabel}
        </div>
      </div>
    );
  },
}));

describe('LimitsTab', () => {
  it('renders capped rows as progress bars under the "Cost caps" section', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Tokens per day',
              used: 12,
              total: 20,
              valueLabel: '12 / 20',
              ariaLabel: '12 of 20 tokens',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Cost caps')).toBeTruthy();
    expect(screen.getByText('12 / 20')).toBeTruthy();

    const progress = screen.getByRole('progressbar', {
      name: 'Tokens per day',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('12');
    expect(progress.getAttribute('aria-valuemax')).toBe('20');
    expect(progress.getAttribute('aria-valuetext')).toBe('12 of 20 tokens');
    expect(progress.getAttribute('data-size')).toBe('small');
  });

  it('renders nothing without limit rows', () => {
    const { container } = render(<LimitsTab limits={{ rows: [] }} />);

    // Component renders null; no semantic query can assert total absence of output.
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });

  it('renders unlimited rows as plain label/value rows under the "Unlimited" section, even when total is a large sentinel value', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Cost per week',
              used: 0.119012,
              // Backend reports unlimited rows with a large sentinel total
              // (see map-deployment-limits-to-catalog.ts), not zero.
              total: Number.MAX_SAFE_INTEGER,
              isUnlimited: true,
              valueLabel: 'Unlimited',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Unlimited', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('Cost per week')).toBeTruthy();
    expect(screen.getByText('Unlimited', { selector: 'span' })).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('renders unlimited rows as plain listitems with no divider or zebra styling', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Requests per hour',
              used: 0,
              total: Number.MAX_SAFE_INTEGER,
              isUnlimited: true,
              valueLabel: 'Unlimited',
            },
            {
              label: 'Requests per day',
              used: 0,
              total: Number.MAX_SAFE_INTEGER,
              isUnlimited: true,
              valueLabel: 'Unlimited',
            },
          ],
        }}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.className).not.toContain('divider');
      expect(row.className).not.toContain('rowAlt');
    });
  });

  it('renders unlimited-row labels and values in tiny text by default', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Requests per hour',
              used: 0,
              total: Number.MAX_SAFE_INTEGER,
              isUnlimited: true,
              valueLabel: 'Unlimited',
            },
          ],
        }}
      />,
    );

    const label = screen.getByText('Requests per hour');
    const value = screen.getByText('Unlimited', { selector: 'span' });
    expect(label.className).toContain('dial-tiny-text');
    expect(label.className).not.toContain('dial-small-semi-text');
    expect(value.className).toContain('dial-tiny-text');
  });

  it('splits rows into "Cost caps" and "Unlimited" sections using the isUnlimited flag, not just total', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Cost per day',
              used: 0,
              total: 100,
              valueLabel: '$0 / $100',
            },
            {
              label: 'Requests per hour',
              used: 0,
              total: Number.MAX_SAFE_INTEGER,
              isUnlimited: true,
              valueLabel: 'Unlimited',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Cost caps')).toBeTruthy();
    expect(screen.getByText('Unlimited', { selector: 'p' })).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Cost per day' }),
    ).toBeTruthy();
    expect(screen.getByText('Requests per hour')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('applies the default fill class under 75% usage', () => {
    render(
      <LimitsTab
        limits={{
          rows: [{ label: 'Cost per day', used: 50, total: 100 }],
        }}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Cost per day' });
    expect(progress.className).toContain(styles.progressFillDefault);
    expect(progress.className).not.toContain(styles.progressFillWarning);
    expect(progress.className).not.toContain(styles.progressFillDanger);
  });

  it('applies the warning fill class at 75% usage and above', () => {
    render(
      <LimitsTab
        limits={{
          rows: [{ label: 'Cost per day', used: 75, total: 100 }],
        }}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Cost per day' });
    expect(progress.className).toContain(styles.progressFillWarning);
    expect(progress.className).not.toContain(styles.progressFillDanger);
  });

  it('applies the danger fill class once the limit is reached', () => {
    render(
      <LimitsTab
        limits={{
          rows: [{ label: 'Cost per day', used: 100, total: 100 }],
        }}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Cost per day' });
    expect(progress.className).toContain(styles.progressFillDanger);
    expect(progress.className).not.toContain(styles.progressFillWarning);
  });

  it('renders the limit figure with heavier emphasis than the used figure', () => {
    render(
      <LimitsTab
        limits={{
          rows: [
            {
              label: 'Cost per day',
              used: 0,
              total: 100,
              usedLabel: '$0.00',
              totalLabel: '$100.00',
            },
          ],
        }}
        valueClassName="dial-small-text"
        limitClassName="dial-small-semi-text"
      />,
    );

    const usedText = screen.getByText('$0.00');
    const limitText = screen.getByText('$100.00');
    expect(usedText.className).toContain('dial-small-text');
    expect(limitText.className).toContain('dial-small-semi-text');
  });
});
