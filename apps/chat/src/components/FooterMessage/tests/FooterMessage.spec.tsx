import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigStatus } from '../../../types/user-config-status';
import FooterMessage from '../FooterMessage';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    status: 'ready' as UserConfigStatus,
    footerHtmlMessage: '',
    isFooterEnabled: true,
  },
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    status: mockState.status,
    config: { footerHtmlMessage: mockState.footerHtmlMessage },
  }),
  useFeatureFlag: () => mockState.isFooterEnabled,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderFooter = () => render(<FooterMessage />);

describe('FooterMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.status = UserConfigStatus.Ready;
    mockState.footerHtmlMessage = '';
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
});
