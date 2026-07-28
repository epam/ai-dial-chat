import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigStatus } from '../../../types/user-config-status';
import AnnouncementBanner from '../AnnouncementBanner';

const { mockAppConfigState, mockDismiss } = vi.hoisted(() => ({
  mockAppConfigState: {
    status: 'ready' as UserConfigStatus,
    announcementHtml: null as string | null,
    dismissedText: '',
  },
  mockDismiss: vi.fn(),
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    status: mockAppConfigState.status,
    config: { announcementHtml: mockAppConfigState.announcementHtml },
  }),
}));

vi.mock(
  '../../../hooks/useAnnouncementDismissal/useAnnouncementDismissal',
  () => ({
    useAnnouncementDismissal: () => ({
      dismissedText: mockAppConfigState.dismissedText,
      dismiss: mockDismiss,
    }),
  }),
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialCloseButton: ({
      ariaLabel,
      onClose,
    }: {
      ariaLabel?: string;
      onClose: () => void;
    }) => (
      <button aria-label={ariaLabel} onClick={onClose}>
        close
      </button>
    ),
  };
});

describe('AnnouncementBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppConfigState.status = UserConfigStatus.Ready;
    mockAppConfigState.announcementHtml = null;
    mockAppConfigState.dismissedText = '';
  });

  it('renders the sanitized message as HTML when ready with a non-empty, non-dismissed message', () => {
    mockAppConfigState.announcementHtml = 'Welcome to <b>DIAL</b>!';
    render(<AnnouncementBanner />);

    expect(screen.getByText('DIAL').tagName).toBe('B');
  });

  it('exposes the banner as a named region', () => {
    mockAppConfigState.announcementHtml = 'Welcome!';
    render(<AnnouncementBanner />);

    expect(
      screen.getByRole('region', {
        name: 'announcementBanner.regionAriaLabel',
      }),
    ).toBeTruthy();
  });

  it('renders nothing when the announcement message is empty', () => {
    mockAppConfigState.announcementHtml = '';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing when the announcement message is null', () => {
    mockAppConfigState.announcementHtml = null;
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing while app-config is loading', () => {
    mockAppConfigState.status = UserConfigStatus.Loading;
    mockAppConfigState.announcementHtml = 'Welcome!';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing when app-config errored', () => {
    mockAppConfigState.status = UserConfigStatus.Error;
    mockAppConfigState.announcementHtml = 'Welcome!';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing when the message equals the dismissed text', () => {
    mockAppConfigState.announcementHtml = 'Welcome!';
    mockAppConfigState.dismissedText = 'Welcome!';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders again when the message changes after a prior dismissal', () => {
    mockAppConfigState.announcementHtml = 'New message!';
    mockAppConfigState.dismissedText = 'Old message!';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region')).toBeTruthy();
  });

  it('calls dismiss with the current message when the close button is clicked', async () => {
    mockAppConfigState.announcementHtml = 'Welcome!';
    render(<AnnouncementBanner />);

    await userEvent.click(
      screen.getByRole('button', { name: 'announcementBanner.closeLabel' }),
    );

    expect(mockDismiss).toHaveBeenCalledOnce();
    expect(mockDismiss).toHaveBeenCalledWith('Welcome!');
  });
});

describe('AnnouncementBanner — sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppConfigState.status = UserConfigStatus.Ready;
    mockAppConfigState.dismissedText = '';
  });

  it('strips disallowed elements such as <script>', () => {
    mockAppConfigState.announcementHtml = '<script>alert(1)</script>Hello';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region').innerHTML).not.toContain('<script');
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('strips disallowed elements carrying inline event handlers', () => {
    mockAppConfigState.announcementHtml = '<img src=x onerror="alert(1)">Hello';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region').innerHTML).not.toContain('onerror');
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('strips disallowed attributes from allowed tags', () => {
    mockAppConfigState.announcementHtml = '<b onclick="alert(1)">test</b>';
    render(<AnnouncementBanner />);

    const bold = screen.getByText('test');
    expect(bold.tagName).toBe('B');
    expect(bold.getAttribute('onclick')).toBeNull();
  });

  it('neutralizes javascript: URLs in links', () => {
    mockAppConfigState.announcementHtml =
      '<a href="javascript:alert(1)">click</a>';
    render(<AnnouncementBanner />);

    const link = screen.getByText('click');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBeNull();
  });

  it('preserves an allowed link with a safe href', () => {
    mockAppConfigState.announcementHtml =
      'Welcome to <a href="https://dialx.ai">DIAL</a>!';
    render(<AnnouncementBanner />);

    const link = screen.getByText('DIAL');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://dialx.ai');
  });
});
