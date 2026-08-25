import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigStatus } from '../../../types/user-config-status';
import FooterMessage from '../FooterMessage';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    status: 'ready' as UserConfigStatus,
    footerHtmlMessage: '',
    appVersion: '',
    isFooterEnabled: true,
  },
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    status: mockState.status,
    config: {
      footerHtmlMessage: mockState.footerHtmlMessage,
      appVersion: mockState.appVersion,
    },
  }),
  useFeatureFlag: () => mockState.isFooterEnabled,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.['version'] == null
        ? key
        : `${key}:${String(options['version'])}`,
  }),
}));

const renderFooter = () => render(<FooterMessage />);

describe('FooterMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.status = UserConfigStatus.Ready;
    mockState.footerHtmlMessage = '';
    mockState.appVersion = '';
    mockState.isFooterEnabled = true;
  });

  it('renders null when footer feature flag is off', () => {
    mockState.isFooterEnabled = false;
    mockState.footerHtmlMessage = 'Hello';
    renderFooter();

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders null when footerHtmlMessage is empty', () => {
    mockState.footerHtmlMessage = '';
    renderFooter();

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders null while config is loading', () => {
    mockState.status = UserConfigStatus.Loading;
    mockState.footerHtmlMessage = 'Hello';
    renderFooter();

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders the sanitized HTML when ready with content and flag enabled', () => {
    mockState.footerHtmlMessage = 'Version <strong>1.0</strong>';
    renderFooter();

    expect(
      screen.getByRole('region', { name: 'footerMessage.regionAriaLabel' }),
    ).toBeTruthy();
    expect(screen.getByText('1.0').tagName).toBe('STRONG');
  });

  it('strips disallowed tags such as <script> from rendered HTML', () => {
    mockState.footerHtmlMessage = '<script>alert(1)</script>Safe text';
    renderFooter();

    const region = screen.getByRole('region');
    expect(region.innerHTML).not.toContain('<script');
    expect(screen.getByText('Safe text')).toBeTruthy();
  });

  it('strips disallowed attributes such as onerror', () => {
    mockState.footerHtmlMessage = '<img src=x onerror="alert(1)">Safe';
    renderFooter();

    const region = screen.getByRole('region');
    expect(region.innerHTML).not.toContain('onerror');
  });

  describe('version label', () => {
    it('renders the version with no footer message configured', () => {
      mockState.isFooterEnabled = false;
      mockState.footerHtmlMessage = '';
      mockState.appVersion = '0.45.0';
      renderFooter();

      expect(screen.getByRole('region')).toBeTruthy();
      expect(screen.getByText('v0.45.0')).toBeTruthy();
    });

    it('renders the version alongside a footer message', () => {
      mockState.footerHtmlMessage = 'Need <strong>help</strong>?';
      mockState.appVersion = '0.45.0';
      renderFooter();

      expect(screen.getByText('help').tagName).toBe('STRONG');
      expect(screen.getByText('v0.45.0')).toBeTruthy();
    });

    it('hides the footer message but keeps the version when the flag is off', () => {
      mockState.isFooterEnabled = false;
      mockState.footerHtmlMessage = 'Operator copy';
      mockState.appVersion = '0.45.0';
      renderFooter();

      expect(screen.queryByText('Operator copy')).toBeNull();
      expect(screen.getByText('v0.45.0')).toBeTruthy();
    });

    it('renders null when there is neither a message nor a version', () => {
      mockState.footerHtmlMessage = '';
      mockState.appVersion = '';
      renderFooter();

      expect(screen.queryByRole('region')).toBeNull();
    });

    it('renders null while config is loading even with a version', () => {
      mockState.status = UserConfigStatus.Loading;
      mockState.appVersion = '0.45.0';
      renderFooter();

      expect(screen.queryByRole('region')).toBeNull();
    });

    it('renders null when config failed to load', () => {
      mockState.status = UserConfigStatus.Error;
      mockState.appVersion = '0.45.0';
      renderFooter();

      expect(screen.queryByRole('region')).toBeNull();
    });

    it('announces the raw version as readable text', () => {
      mockState.appVersion = '2026.08.10-a1b2c3d';
      renderFooter();

      expect(
        screen.getByText('footerMessage.versionAriaLabel:2026.08.10-a1b2c3d'),
      ).toBeTruthy();
    });

    it('hides the abbreviated glyph run from assistive technology', () => {
      mockState.appVersion = '0.45.0';
      renderFooter();

      expect(screen.getByText('v0.45.0').getAttribute('aria-hidden')).toBe(
        'true',
      );
    });

    it('does not double-prefix an already-tagged version', () => {
      mockState.appVersion = 'v0.45.0';
      renderFooter();

      expect(screen.getByText('v0.45.0')).toBeTruthy();
    });

    it('ignores a whitespace-only version', () => {
      mockState.appVersion = '   ';
      renderFooter();

      expect(screen.queryByRole('region')).toBeNull();
    });

    it('does not intercept pointer events over the footer message', () => {
      mockState.footerHtmlMessage = 'Operator copy';
      mockState.appVersion = '0.45.0';
      renderFooter();

      const label = screen.getByRole('paragraph');
      expect(label?.className).toContain('pointer-events-none');
    });

    it('renders the version glyphs in an isolated ltr direction context', () => {
      mockState.appVersion = '0.45.0';
      renderFooter();

      expect(screen.getByText('v0.45.0').getAttribute('dir')).toBe('ltr');
    });

    it('inherits page direction on the positioned label so the corner flips in RTL', () => {
      mockState.footerHtmlMessage = 'Operator copy';
      mockState.appVersion = '0.45.0';
      renderFooter();

      /* `end-*` is a logical inset resolved against this element's own
       * direction — a `dir` here would defeat the RTL corner flip. */
      const label = screen.getByRole('paragraph');
      expect(label?.hasAttribute('dir')).toBe(false);
      expect(label?.className).toContain('end-4');
    });

    it('keeps the label in flow when there is no footer message to centre', () => {
      mockState.isFooterEnabled = false;
      mockState.appVersion = '0.45.0';
      renderFooter();

      /* Absolute positioning against a section with no in-flow child would
       * place the label outside its collapsed box. */
      const label = screen.getByRole('paragraph');
      expect(label?.className).not.toContain('absolute');
      expect(label?.className).toContain('text-end');
    });
  });
});
