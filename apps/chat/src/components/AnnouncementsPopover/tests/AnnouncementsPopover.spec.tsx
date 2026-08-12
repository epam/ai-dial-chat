import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnnouncementItem } from '../../../models/announcement';
import AnnouncementsPopover from '../AnnouncementsPopover';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count === undefined ? key : `${key}:${String(options.count)}`,
  }),
}));

const makeAnnouncement = (
  overrides?: Partial<AnnouncementItem>,
): AnnouncementItem => ({
  title: 'We have upgraded to DIAL 1.43',
  description: "Check what's new:",
  link: { label: 'Changelog', href: 'https://dialx.ai/changelog' },
  ...overrides,
});

const PILL_NAME = /announcementsPopover\.pillLabel/;

const openPopover = async (announcements: AnnouncementItem[]) => {
  render(<AnnouncementsPopover announcements={announcements} />);
  await userEvent.click(screen.getByRole('button', { name: PILL_NAME }));
};

describe('AnnouncementsPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there are no announcements', () => {
    const { container } = render(<AnnouncementsPopover announcements={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('labels the pill with the announcement count', () => {
    render(
      <AnnouncementsPopover
        announcements={[makeAnnouncement(), makeAnnouncement()]}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'announcementsPopover.pillLabel:2' }),
    ).toBeTruthy();
  });

  it('opens the popover when the pill is activated', async () => {
    await openPopover([makeAnnouncement()]);

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getByText('We have upgraded to DIAL 1.43')).toBeTruthy();
  });

  it('closes the popover when the pill is activated again', async () => {
    await openPopover([makeAnnouncement()]);
    await userEvent.click(screen.getByRole('button', { name: PILL_NAME }));

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('closes the popover on an outside click', async () => {
    await openPopover([makeAnnouncement()]);
    await userEvent.click(document.body);

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('closes the popover on Escape and returns focus to the pill', async () => {
    await openPopover([makeAnnouncement()]);

    /* Move focus into the popover first. Without this the pill still holds
       focus from the opening click, and the assertion below would pass even if
       nothing ever restored it. */
    const link = screen.getByRole('link', { name: /Changelog/ });
    link.focus();
    expect(document.activeElement).toBe(link);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('list')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: PILL_NAME }),
    );
  });

  it('renders one list item per announcement in configured order', async () => {
    await openPopover([
      makeAnnouncement({ title: 'First' }),
      makeAnnouncement({ title: 'Second' }),
      makeAnnouncement({ title: 'Third' }),
    ]);

    const titles = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(titles[0]).toContain('First');
    expect(titles[1]).toContain('Second');
    expect(titles[2]).toContain('Third');
  });

  it('renders the row link as an external anchor', async () => {
    await openPopover([makeAnnouncement()]);

    const link = screen.getByRole('link', { name: /Changelog/ });
    expect(link.getAttribute('href')).toBe('https://dialx.ai/changelog');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders no anchor for an announcement without a link', async () => {
    await openPopover([makeAnnouncement({ link: null })]);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('We have upgraded to DIAL 1.43')).toBeTruthy();
  });

  it('renders no description element for an announcement without one', async () => {
    await openPopover([makeAnnouncement({ description: null })]);

    const item = screen.getByRole('listitem');
    expect(item.textContent).toContain('We have upgraded to DIAL 1.43');
    expect(item.textContent).not.toContain("Check what's new:");
  });
});

describe('AnnouncementsPopover — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the collapsed state and popup semantics on the pill', () => {
    render(<AnnouncementsPopover announcements={[makeAnnouncement()]} />);

    const pill = screen.getByRole('button', { name: PILL_NAME });
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(pill.getAttribute('aria-haspopup')).toBe('true');
    expect(pill.getAttribute('aria-controls')).toBeTruthy();
  });

  it('flips aria-expanded when the popover opens', async () => {
    await openPopover([makeAnnouncement()]);

    expect(
      screen
        .getByRole('button', { name: PILL_NAME })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('points aria-controls at the rendered overlay', async () => {
    await openPopover([makeAnnouncement()]);

    const controlledId = screen
      .getByRole('button', { name: PILL_NAME })
      .getAttribute('aria-controls');
    expect(document.getElementById(controlledId ?? '')).toBeTruthy();
  });

  it('announces the overlay as a labeled region containing a list', async () => {
    await openPopover([makeAnnouncement(), makeAnnouncement()]);

    expect(
      screen.getByRole('region', {
        name: 'announcementsPopover.listAriaLabel',
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('creates no headings for row titles', async () => {
    await openPopover([makeAnnouncement(), makeAnnouncement()]);

    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('tells assistive technology that row links open a new tab', async () => {
    await openPopover([makeAnnouncement()]);

    expect(
      screen.getByRole('link', {
        name: /announcementsPopover\.opensInNewTab/,
      }),
    ).toBeTruthy();
  });
});

describe('AnnouncementsPopover — sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips script content from a row description', async () => {
    await openPopover([
      makeAnnouncement({ description: '<script>alert(1)</script>Hello' }),
    ]);

    const item = screen.getByRole('listitem');
    expect(item.innerHTML).not.toContain('<script');
    expect(item.textContent).toContain('Hello');
  });

  it('preserves safe markup in a row description', async () => {
    await openPopover([
      makeAnnouncement({ description: 'Check <strong>what is new</strong>' }),
    ]);

    expect(screen.getByText('what is new').tagName).toBe('STRONG');
  });

  it('renders a row title containing markup as literal text', async () => {
    await openPopover([makeAnnouncement({ title: 'Release <b>3.0</b>' })]);

    expect(screen.getByText('Release <b>3.0</b>')).toBeTruthy();
    expect(screen.getByRole('listitem').innerHTML).not.toContain('<b>3.0</b>');
  });
});
