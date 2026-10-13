import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageLimitBannerSeverity } from '../../../models/UsageLimitBanner';
import type { UsageLimitBannerViewProps } from '../../../models/UsageLimitBanner';
import { UsageLimitBannerView } from '../UsageLimitBannerView';

const RESET = {
  isoValue: '2026-11-01T00:00:00Z',
  label: 'Resets on Nov 1.',
};
const SPOKEN = 'Usage resets Nov 1, 2026, 12:00 AM Coordinated Universal Time';

const renderView = (props: Partial<UsageLimitBannerViewProps> = {}) =>
  render(
    <UsageLimitBannerView
      severity={UsageLimitBannerSeverity.Warning}
      limitText="Daily limit 80% used."
      {...props}
    />,
  );

describe('UsageLimitBannerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      UsageLimitBannerSeverity.Warning,
      'tabler-icon-alert-triangle-filled',
      'text-warning',
    ],
    [
      UsageLimitBannerSeverity.Reached,
      'tabler-icon-alert-circle-filled',
      'text-error',
    ],
  ])(
    'renders the %s severity with the %s icon',
    (severity, iconClass, colorClass) => {
      renderView({ severity });

      // eslint-disable-next-line testing-library/no-node-access -- the icon is aria-hidden; its glyph and color classes are the assertion
      const icon = screen.getByRole('status').querySelector('svg');
      expect(icon?.classList.contains(iconClass)).toBe(true);
      // eslint-disable-next-line testing-library/no-node-access -- the color class sits on the icon's wrapper
      expect(icon?.parentElement?.classList.contains(colorClass)).toBe(true);
    },
  );

  it('names the close button with the default and a custom label', () => {
    const { rerender } = renderView({ onClose: vi.fn() });
    expect(
      screen.getByRole('button', { name: 'Close notification' }),
    ).toBeTruthy();

    rerender(
      <UsageLimitBannerView
        severity={UsageLimitBannerSeverity.Warning}
        limitText="Daily limit 80% used."
        onClose={vi.fn()}
        closeAriaLabel="Close usage notice"
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Close usage notice' }),
    ).toBeTruthy();
  });

  it.each([UsageLimitBannerSeverity.Warning, UsageLimitBannerSeverity.Reached])(
    'announces the %s severity politely through role="status"',
    (severity) => {
      renderView({ severity });

      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('renders the limit sentence followed by the reset sentence in a <time>', () => {
    renderView({
      severity: UsageLimitBannerSeverity.Reached,
      limitText: 'Monthly limit reached.',
      reset: RESET,
    });

    expect(screen.getByRole('status').textContent).toBe(
      'Monthly limit reached. Resets on Nov 1.',
    );
    const time = screen.getByText('Resets on Nov 1.');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('dateTime')).toBe(RESET.isoValue);
  });

  it('hides the <time> and announces the spoken form from an sr-only sibling', () => {
    renderView({ reset: { ...RESET, ariaLabel: SPOKEN } });

    const time = screen.getByText('Resets on Nov 1.');
    expect(time.getAttribute('aria-hidden')).toBe('true');
    const spoken = screen.getByText(SPOKEN);
    expect(spoken.className).toContain('sr-only');
    expect(
      time.compareDocumentPosition(spoken) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('leaves the <time> exposed when no spoken form is given', () => {
    renderView({ reset: RESET });

    expect(
      screen.getByText('Resets on Nov 1.').hasAttribute('aria-hidden'),
    ).toBe(false);
  });

  it('renders only the limit sentence without a reset', () => {
    renderView();

    expect(screen.getByRole('status').textContent).toBe(
      'Daily limit 80% used.',
    );
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    renderView({ onClose });

    await userEvent.click(screen.getByRole('button'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the close button is reached by Tab and pressed with Enter', async () => {
    const onClose = vi.fn();
    renderView({ onClose });

    await userEvent.tab();
    // eslint-disable-next-line testing-library/no-node-access -- keyboard reachability is observable through the active element
    expect(document.activeElement).toBe(screen.getByRole('button'));
    await userEvent.keyboard('{Enter}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders no close button without onClose', () => {
    renderView();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('carries the public class together with the host class', () => {
    renderView({ className: 'mb-0' });

    const banner = screen.getByRole('status');
    expect(banner.classList.contains('dial-ci-usage-banner')).toBe(true);
    expect(banner.classList.contains('mb-0')).toBe(true);
  });

  it('applies the default and a custom limit-sentence class', () => {
    const { rerender } = renderView();
    expect(
      screen
        .getByText('Daily limit 80% used.')
        .classList.contains('dial-small-paragraph-semi-text'),
    ).toBe(true);

    rerender(
      <UsageLimitBannerView
        severity={UsageLimitBannerSeverity.Warning}
        limitText="Daily limit 80% used."
        limitTextClassName="dial-small-semi-text"
      />,
    );
    expect(screen.getByText('Daily limit 80% used.').className).toBe(
      'dial-small-semi-text',
    );
  });

  it('applies the reset-sentence class to the <time>', () => {
    renderView({ reset: RESET, resetTextClassName: 'dial-small-text' });

    expect(screen.getByText('Resets on Nov 1.').className).toBe(
      'dial-small-text',
    );
  });

  it('sets no fixed width, so it wraps inside its container', () => {
    renderView({ reset: RESET });

    const banner = screen.getByRole('status');
    expect(banner.className).not.toMatch(/(^|\s)(w|min-w)-\[?\d/);
    expect(banner.style.width).toBe('');
  });

  it('renders host text verbatim', () => {
    renderView({ limitText: 'Tageslimit zu 80 % verbraucht.' });

    expect(screen.getByText('Tageslimit zu 80 % verbraucht.')).toBeTruthy();
  });

  it('keeps its content order and roles under dir="rtl"', () => {
    render(
      <div dir="rtl">
        <UsageLimitBannerView
          severity={UsageLimitBannerSeverity.Warning}
          limitText="Daily limit 80% used."
          reset={RESET}
          onClose={vi.fn()}
        />
      </div>,
    );

    const banner = screen.getByRole('status');
    const sentence = screen.getByText('Daily limit 80% used.');
    const time = screen.getByText('Resets on Nov 1.');
    expect(
      sentence.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(banner.contains(screen.getByRole('button'))).toBe(true);
  });
});
