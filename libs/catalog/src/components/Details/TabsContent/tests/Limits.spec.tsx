import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LimitsTab } from '../Limits/Limits';
import styles from '../Limits/Limits.module.scss';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard' },
  ProgressBar: ({
    value,
    max,
    size,
    className,
    'aria-label': ariaLabel,
    'aria-valuetext': ariaValueText,
  }: {
    value: number;
    max?: number;
    size?: string;
    className?: string;
    'aria-label'?: string;
    'aria-valuetext'?: string;
  }) => (
    <div
      role="progressbar"
      className={className}
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemax={max}
      aria-valuetext={ariaValueText}
      data-size={size}
    />
  ),
}));

describe('LimitsTab', () => {
  it('renders capped rows as progress bars under their group heading', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Token limits',
              rows: [
                {
                  label: 'Tokens per day',
                  used: 12,
                  total: 20,
                  valueLabel: '12 / 20',
                  ariaLabel: '12 of 20 tokens',
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Token limits')).toBeTruthy();
    expect(screen.getByText('12 / 20')).toBeTruthy();

    const progress = screen.getByRole('progressbar', {
      name: 'Tokens per day',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('12');
    expect(progress.getAttribute('aria-valuemax')).toBe('20');
    expect(progress.getAttribute('aria-valuetext')).toBe('12 of 20 tokens');
    expect(progress.getAttribute('data-size')).toBe('small');
  });

  it("renders a row's optional captionLabel under its label", () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Token limits',
              rows: [
                {
                  label: 'Last 24 hours',
                  used: 12,
                  total: 20,
                  captionLabel: '$0.50 spent',
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Last 24 hours')).toBeTruthy();
    expect(screen.getByText('$0.50 spent')).toBeTruthy();
  });

  it('omits the captionLabel line when absent', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Token limits',
              rows: [{ label: 'Last 24 hours', used: 12, total: 20 }],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText(/spent/)).toBeNull();
  });

  it('renders nothing without limit groups', () => {
    const { container } = render(<LimitsTab limits={{ groups: [] }} />);

    // Component renders null; no semantic query can assert total absence of output.
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when every group has no rows', () => {
    const { container } = render(
      <LimitsTab
        limits={{
          groups: [
            { label: 'Token limits', rows: [] },
            { label: 'Cost limits', rows: [] },
          ],
        }}
      />,
    );

    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });

  it('omits an empty group while still rendering a non-empty one', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            { label: 'Token limits', rows: [] },
            {
              label: 'Cost limits',
              rows: [{ label: 'Last 24 hours', used: 0, total: 100 }],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText('Token limits')).toBeNull();
    expect(screen.getByText('Cost limits')).toBeTruthy();
  });

  it('renders each group under its own heading, in the supplied order', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Token limits',
              rows: [{ label: 'Tokens per minute', used: 0, total: 100 }],
            },
            {
              label: 'Cost limits',
              rows: [{ label: 'Last minute', used: 0, total: 100 }],
            },
          ],
        }}
      />,
    );

    const headings = screen.getAllByText(/Token limits|Cost limits/);
    expect(headings.map((el) => el.textContent)).toEqual([
      'Token limits',
      'Cost limits',
    ]);
  });

  it('renders a row with no usable total as a plain value with no progress bar, even when total is a large sentinel value', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [
                {
                  label: 'Last 7 days',
                  used: 0.119012,
                  // Backend reports unlimited rows with a large sentinel total
                  // (see map-deployment-limits-to-catalog.ts), not zero.
                  total: Number.MAX_SAFE_INTEGER,
                  isUnlimited: true,
                  valueLabel: 'Unlimited',
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Last 7 days')).toBeTruthy();
    expect(screen.getByText('Unlimited')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it("renders a no-progress row's optional noteLabel as a secondary caption under the value", () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Token limits',
              rows: [
                {
                  label: 'Tokens per day',
                  used: 210000,
                  total: Number.MAX_SAFE_INTEGER,
                  isUnlimited: true,
                  valueLabel: '210k',
                  noteLabel: 'Follows cost limit',
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('210k')).toBeTruthy();
    expect(screen.getByText('Follows cost limit')).toBeTruthy();
  });

  it('omits the noteLabel caption when absent', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Token limits',
              rows: [
                {
                  label: 'Tokens per minute',
                  used: 0,
                  total: Number.MAX_SAFE_INTEGER,
                  isUnlimited: true,
                  valueLabel: 'Unlimited',
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText('Follows cost limit')).toBeNull();
  });

  it('renders capped and no-progress rows together within the same group', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [
                {
                  label: 'Last 24 hours',
                  used: 0,
                  total: 100,
                  valueLabel: '$0 / $100',
                },
                {
                  label: 'Last 7 days',
                  used: 0,
                  total: Number.MAX_SAFE_INTEGER,
                  isUnlimited: true,
                  valueLabel: 'Unlimited',
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('Cost limits')).toHaveLength(1);
    expect(
      screen.getByRole('progressbar', { name: 'Last 24 hours' }),
    ).toBeTruthy();
    expect(screen.getByText('Last 7 days')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('applies the default fill class under 75% usage', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [{ label: 'Last 24 hours', used: 50, total: 100 }],
            },
          ],
        }}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Last 24 hours' });
    expect(progress.className).toContain(styles.progressFillDefault);
    expect(progress.className).not.toContain(styles.progressFillWarning);
    expect(progress.className).not.toContain(styles.progressFillDanger);
  });

  it('applies the warning fill class at 75% usage and above', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [{ label: 'Last 24 hours', used: 75, total: 100 }],
            },
          ],
        }}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Last 24 hours' });
    expect(progress.className).toContain(styles.progressFillWarning);
    expect(progress.className).not.toContain(styles.progressFillDanger);
  });

  it('applies the danger fill class once the limit is reached', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [{ label: 'Last 24 hours', used: 100, total: 100 }],
            },
          ],
        }}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Last 24 hours' });
    expect(progress.className).toContain(styles.progressFillDanger);
    expect(progress.className).not.toContain(styles.progressFillWarning);
  });

  it("renders a capped row's used figure with primary emphasis and its total figure secondary", () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [
                {
                  label: 'Last 24 hours',
                  used: 0,
                  total: 100,
                  usedLabel: '$0.00',
                  totalLabel: '$100.00',
                },
              ],
            },
          ],
        }}
      />,
    );

    const usedText = screen.getByText('$0.00');
    const totalText = screen.getByText('/ $100.00');
    expect(usedText.className).toContain(styles.valuePrimary);
    expect(totalText.className).toContain(styles.label);
  });

  it('hides the footer note by default', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [{ label: 'Last 24 hours', used: 0, total: 100 }],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText('View full usage limits')).toBeNull();
  });

  it('renders the footer note when supplied', () => {
    render(
      <LimitsTab
        limits={{
          groups: [
            {
              label: 'Cost limits',
              rows: [{ label: 'Last 24 hours', used: 0, total: 100 }],
            },
          ],
        }}
        footerNote="View full usage limits"
      />,
    );

    expect(screen.getByText('View full usage limits')).toBeTruthy();
  });
});
