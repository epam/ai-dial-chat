import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnnouncementItem } from '../../../models/announcement';
import { UserConfigStatus } from '../../../types/user-config-status';
import AnnouncementBanner from '../AnnouncementBanner';

const { mockAppConfigState, mockDismiss } = vi.hoisted(() => ({
  mockAppConfigState: {
    status: 'ready' as UserConfigStatus,
    announcementHtml: null as string | null,
    announcementTitle: null as string | null,
    announcementDescription: null as string | null,
    announcements: [] as AnnouncementItem[],
    isDismissed: false,
  },
  mockDismiss: vi.fn(),
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    status: mockAppConfigState.status,
    config: {
      announcementHtml: mockAppConfigState.announcementHtml,
      announcementTitle: mockAppConfigState.announcementTitle,
      announcementDescription: mockAppConfigState.announcementDescription,
      announcements: mockAppConfigState.announcements,
    },
  }),
}));

vi.mock(
  '../../../hooks/useAnnouncementDismissal/useAnnouncementDismissal',
  () => ({
    useAnnouncementDismissal: () => ({
      isDismissed: mockAppConfigState.isDismissed,
      dismiss: mockDismiss,
    }),
  }),
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.title ? `${key}:${String(options.title)}` : key,
  }),
}));

const resetState = () => {
  vi.clearAllMocks();
  mockAppConfigState.status = UserConfigStatus.Ready;
  mockAppConfigState.announcementHtml = null;
  mockAppConfigState.announcementTitle = null;
  mockAppConfigState.announcementDescription = null;
  mockAppConfigState.announcements = [];
  mockAppConfigState.isDismissed = false;
};

const makeAnnouncement = (title: string): AnnouncementItem => ({
  title,
  description: null,
  link: { label: 'Register', href: 'https://dialx.ai' },
});

describe('AnnouncementBanner — visibility', () => {
  beforeEach(resetState);

  it('renders when only a title is configured', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    render(<AnnouncementBanner />);

    expect(screen.getByText('Welcome to DIAL')).toBeTruthy();
  });

  it('renders when only a description is configured', () => {
    mockAppConfigState.announcementDescription = 'Explore our AI offerings.';
    render(<AnnouncementBanner />);

    expect(screen.getByText('Explore our AI offerings.')).toBeTruthy();
  });

  it('renders when only the legacy message is configured', () => {
    mockAppConfigState.announcementHtml = 'Welcome to <b>DIAL</b>!';
    render(<AnnouncementBanner />);

    expect(screen.getByText('DIAL').tagName).toBe('B');
  });

  it('renders nothing when every announcement field is empty', () => {
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing when the fields are empty strings', () => {
    mockAppConfigState.announcementTitle = '';
    mockAppConfigState.announcementDescription = '';
    mockAppConfigState.announcementHtml = '';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing while app-config is loading', () => {
    mockAppConfigState.status = UserConfigStatus.Loading;
    mockAppConfigState.announcementTitle = 'Welcome';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing when app-config errored', () => {
    mockAppConfigState.status = UserConfigStatus.Error;
    mockAppConfigState.announcementTitle = 'Welcome';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing when the announcement has been dismissed', () => {
    mockAppConfigState.announcementTitle = 'Welcome';
    mockAppConfigState.isDismissed = true;
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('dismisses when the close control is clicked', async () => {
    mockAppConfigState.announcementTitle = 'Welcome';
    render(<AnnouncementBanner />);

    await userEvent.click(
      screen.getByRole('button', { name: 'announcementBanner.closeLabel' }),
    );

    expect(mockDismiss).toHaveBeenCalledOnce();
  });
});

describe('AnnouncementBanner — structured layout', () => {
  beforeEach(resetState);

  it('renders the title before the description', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    mockAppConfigState.announcementDescription = 'Explore our AI offerings.';
    render(<AnnouncementBanner />);

    const region = screen.getByRole('region');
    const text = region.textContent ?? '';
    expect(text.indexOf('Welcome to DIAL')).toBeLessThan(
      text.indexOf('Explore our AI offerings.'),
    );
  });

  it('emphasizes the title without creating a heading', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    render(<AnnouncementBanner />);

    expect(screen.getByText('Welcome to DIAL').className).toContain(
      'dial-small-paragraph-semi-text',
    );
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders no description element when the description is unset', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region').textContent).toBe('Welcome to DIAL');
  });

  it('renders no title element when the title is unset', () => {
    mockAppConfigState.announcementDescription = 'Explore our AI offerings.';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region').textContent).toBe(
      'Explore our AI offerings.',
    );
  });

  it('ignores the legacy message when structured content is configured', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    mockAppConfigState.announcementHtml = 'Legacy message';
    render(<AnnouncementBanner />);

    expect(screen.queryByText('Legacy message')).toBeNull();
    expect(screen.getByText('Welcome to DIAL')).toBeTruthy();
  });

  it('truncates on one line with the full text left in the DOM', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    mockAppConfigState.announcementDescription =
      'A description long enough that it would overrun the banner width.';
    render(<AnnouncementBanner />);

    /* Both spans must truncate independently: the parent is a flex container,
       where text-overflow does nothing, and a flex item without min-w-0 is
       hard-clipped with no ellipsis. */
    const title = screen.getByText('Welcome to DIAL');
    expect(title.className).toContain('truncate');
    expect(title.className).toContain('min-w-0');

    const paragraph = title.parentElement;
    expect(paragraph?.className).toContain('min-w-0');
    expect(paragraph?.textContent).toContain(
      'A description long enough that it would overrun the banner width.',
    );
  });

  it('truncates a long title so it cannot push the description out unclipped', () => {
    mockAppConfigState.announcementTitle =
      'A title long enough on its own to consume the entire banner line width';
    mockAppConfigState.announcementDescription = 'And a description after it.';
    render(<AnnouncementBanner />);

    const title = screen.getByText(
      'A title long enough on its own to consume the entire banner line width',
    );
    expect(title.className).toContain('truncate');
    expect(title.className).toContain('min-w-0');
  });

  it('keeps the close control outside the truncating container', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    render(<AnnouncementBanner />);

    const closeButton = screen.getByRole('button', {
      name: 'announcementBanner.closeLabel',
    });
    const paragraph = screen.getByText('Welcome to DIAL').parentElement;
    expect(paragraph?.contains(closeButton)).toBe(false);
  });

  it('starts the text at the leading edge rather than centering it', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    render(<AnnouncementBanner />);

    const paragraph = screen.getByText('Welcome to DIAL').parentElement;
    expect(paragraph?.className).toContain('text-start');
    expect(paragraph?.className).not.toContain('text-center');
  });
});

describe('AnnouncementBanner — announcements pill', () => {
  beforeEach(resetState);

  const PILL_NAME = /announcementsPopover\.pillLabel/;

  it('renders the pill when announcements are configured', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    mockAppConfigState.announcements = [
      makeAnnouncement('Upgraded to 1.43'),
      makeAnnouncement('AI:Run Mission 2026'),
    ];
    render(<AnnouncementBanner />);

    expect(screen.getByRole('button', { name: PILL_NAME })).toBeTruthy();
  });

  it('renders no pill when there are no announcements', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('button', { name: PILL_NAME })).toBeNull();
  });

  it('places the pill between the text and the close control', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    mockAppConfigState.announcements = [makeAnnouncement('Upgraded to 1.43')];
    render(<AnnouncementBanner />);

    const region = screen.getByRole('region');
    const paragraph = screen.getByText('Welcome to DIAL').closest('p');
    const pill = screen.getByRole('button', { name: PILL_NAME });
    const closeButton = screen.getByRole('button', {
      name: 'announcementBanner.closeLabel',
    });

    const order = Array.from(region.children);
    expect(order.indexOf(paragraph as Element)).toBeLessThan(
      order.findIndex((child) => child.contains(pill)),
    );
    expect(order.findIndex((child) => child.contains(pill))).toBeLessThan(
      order.findIndex((child) => child.contains(closeButton)),
    );
  });

  it('keeps the pill outside the truncating text container', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    mockAppConfigState.announcements = [makeAnnouncement('Upgraded to 1.43')];
    render(<AnnouncementBanner />);

    const paragraph = screen.getByText('Welcome to DIAL').closest('p');
    const pill = screen.getByRole('button', { name: PILL_NAME });
    expect(paragraph?.contains(pill)).toBe(false);
  });

  it('renders no pill in the legacy layout', () => {
    mockAppConfigState.announcementHtml = 'Welcome!';
    mockAppConfigState.announcements = [makeAnnouncement('Upgraded to 1.43')];
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('button', { name: PILL_NAME })).toBeNull();
  });
});

describe('AnnouncementBanner — legacy layout', () => {
  beforeEach(resetState);

  it('keeps the centered layout for a legacy-only announcement', () => {
    mockAppConfigState.announcementHtml = 'Welcome!';
    render(<AnnouncementBanner />);

    expect(screen.getByText('Welcome!').className).toContain('text-center');
    expect(screen.getByRole('region').className).toContain('justify-center');
  });
});

describe('AnnouncementBanner — accessibility', () => {
  beforeEach(resetState);

  it('names the region after the configured title', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    render(<AnnouncementBanner />);

    expect(
      screen.getByRole('region', {
        name: 'announcementBanner.regionAriaLabelWithTitle:Welcome to DIAL',
      }),
    ).toBeTruthy();
  });

  it('falls back to the generic region name when no title is configured', () => {
    mockAppConfigState.announcementDescription = 'Explore our AI offerings.';
    render(<AnnouncementBanner />);

    expect(
      screen.getByRole('region', {
        name: 'announcementBanner.regionAriaLabel',
      }),
    ).toBeTruthy();
  });

  it('exposes the legacy banner as a named region', () => {
    mockAppConfigState.announcementHtml = 'Welcome!';
    render(<AnnouncementBanner />);

    expect(
      screen.getByRole('region', {
        name: 'announcementBanner.regionAriaLabel',
      }),
    ).toBeTruthy();
  });
});

describe('AnnouncementBanner — RTL', () => {
  beforeEach(resetState);

  /* The banner has no direction-aware JS: it mirrors purely through logical
   * properties inherited from the `dir` attribute, so a physical-direction
   * utility sneaking in is the only way it can break under rtl. */
  const PHYSICAL_CLASS =
    /\b(ml|mr|pl|pr|left|right|border-l|border-r)-|\btext-(left|right)\b/;

  it('uses only logical direction utilities', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    mockAppConfigState.announcementDescription = 'Explore our AI offerings.';
    const { container } = render(<AnnouncementBanner />);

    const classNames = Array.from(container.querySelectorAll('*'))
      .map((element) => element.className)
      .filter((name): name is string => typeof name === 'string');

    classNames.forEach((name) => expect(name).not.toMatch(PHYSICAL_CLASS));
  });

  it('renders the same markup under dir="rtl"', () => {
    mockAppConfigState.announcementTitle = 'Welcome to DIAL';
    document.documentElement.dir = 'rtl';

    render(<AnnouncementBanner />);

    expect(screen.getByText('Welcome to DIAL')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'announcementBanner.closeLabel' }),
    ).toBeTruthy();

    document.documentElement.dir = '';
  });
});

describe('AnnouncementBanner — sanitization', () => {
  beforeEach(resetState);

  it('renders the title as text rather than markup', () => {
    mockAppConfigState.announcementTitle = 'Release <b>3.0</b>';
    render(<AnnouncementBanner />);

    expect(screen.getByText('Release <b>3.0</b>')).toBeTruthy();
    expect(screen.getByRole('region').innerHTML).not.toContain('<b>3.0</b>');
  });

  it('preserves safe markup in the description', () => {
    mockAppConfigState.announcementDescription =
      'Explore our <strong>AI offerings</strong>.';
    render(<AnnouncementBanner />);

    expect(screen.getByText('AI offerings').tagName).toBe('STRONG');
  });

  it('strips disallowed elements such as <script> from the description', () => {
    mockAppConfigState.announcementDescription =
      '<script>alert(1)</script>Hello';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region').innerHTML).not.toContain('<script');
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('strips inline event handlers from the description', () => {
    mockAppConfigState.announcementDescription =
      '<img src=x onerror="alert(1)">Hello';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region').innerHTML).not.toContain('onerror');
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('neutralizes javascript: URLs in the description', () => {
    mockAppConfigState.announcementDescription =
      '<a href="javascript:alert(1)">click</a>';
    render(<AnnouncementBanner />);

    const link = screen.getByText('click');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBeNull();
  });

  it('preserves an allowed description link with a safe href', () => {
    mockAppConfigState.announcementDescription =
      'Explore <a href="https://dialx.ai">DIAL</a>!';
    render(<AnnouncementBanner />);

    const link = screen.getByText('DIAL');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://dialx.ai');
  });

  it('strips disallowed elements from the legacy message', () => {
    mockAppConfigState.announcementHtml = '<script>alert(1)</script>Hello';
    render(<AnnouncementBanner />);

    expect(screen.getByRole('region').innerHTML).not.toContain('<script');
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('neutralizes javascript: URLs in the legacy message', () => {
    mockAppConfigState.announcementHtml = '<a href="javascript:alert(1)">x</a>';
    render(<AnnouncementBanner />);

    expect(screen.getByText('x').getAttribute('href')).toBeNull();
  });

  it('renders nothing when the legacy message sanitizes away entirely', () => {
    mockAppConfigState.announcementHtml = '<script>alert(1)</script>';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('renders nothing when the description sanitizes away and no title is set', () => {
    mockAppConfigState.announcementDescription = '<script>alert(1)</script>';
    render(<AnnouncementBanner />);

    expect(screen.queryByRole('region')).toBeNull();
  });
});
