import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishHistoryEntry } from '../../../models/publish';
import { formatPublishedDate } from '../../../utils/format-published-date';
import { PublishHistoryList } from '../PublishHistoryList';

/*
 * The util's own spec covers its real Intl formatting; mocking it here keeps
 * the component test stable across locales, timezones and ICU builds.
 */
vi.mock('../../../utils/format-published-date', () => ({
  formatPublishedDate: vi.fn(
    (publishedAt: number) => `formatted:${publishedAt}`,
  ),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

const entries: PublishHistoryEntry[] = [
  {
    version: '4.0.0',
    publishedAt: Date.now() - 3 * DAY_MS,
    folderPath: ['Shared', 'Data Science', 'Published models'],
  },
  {
    version: '3.9.0',
    publishedAt: Date.now() - 90 * DAY_MS,
    folderPath: ['Shared', 'Production'],
  },
];

describe('PublishHistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty-state message when there are no entries', () => {
    render(<PublishHistoryList entries={[]} />);
    expect(
      screen.getByText(
        'Not published to this folder yet — this will be the first version here.',
      ),
    ).toBeTruthy();
  });

  it('renders a row for each history entry', () => {
    render(<PublishHistoryList entries={entries} />);
    expect(screen.getByText('Version 4.0.0')).toBeTruthy();
    expect(screen.getByText('Version 3.9.0')).toBeTruthy();
  });

  it('marks an entry that carried shared credentials', () => {
    render(
      <PublishHistoryList
        entries={[{ ...entries[0], publishCredentials: true }]}
      />,
    );
    expect(screen.getByText('Shared credentials')).toBeTruthy();
  });

  it('uses the host-supplied shared-credentials label', () => {
    render(
      <PublishHistoryList
        entries={[{ ...entries[0], publishCredentials: true }]}
        sharedCredentialsLabel="Identifiants partagés"
      />,
    );
    expect(screen.getByText('Identifiants partagés')).toBeTruthy();
  });

  it('leaves an entry without the flag unmarked', () => {
    render(
      <PublishHistoryList
        entries={[{ ...entries[0], publishCredentials: false }, entries[1]]}
      />,
    );
    expect(screen.queryByText('Shared credentials')).toBeNull();
  });

  it('renders each entry with the date produced by formatPublishedDate', () => {
    render(<PublishHistoryList entries={entries} />);
    expect(
      screen.getByText(`formatted:${entries[0].publishedAt}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`formatted:${entries[1].publishedAt}`),
    ).toBeTruthy();
  });

  it('passes each entry timestamp to formatPublishedDate', () => {
    render(<PublishHistoryList entries={entries} />);
    expect(vi.mocked(formatPublishedDate)).toHaveBeenCalledWith(
      entries[0].publishedAt,
    );
    expect(vi.mocked(formatPublishedDate)).toHaveBeenCalledWith(
      entries[1].publishedAt,
    );
  });

  it('does not render the destination folder path, since this list is already scoped to it', () => {
    render(<PublishHistoryList entries={entries} />);
    expect(screen.queryByText('Shared')).toBeNull();
    expect(screen.queryByText('Data Science')).toBeNull();
    expect(screen.queryByText('Published models')).toBeNull();
    expect(screen.queryByText('Production')).toBeNull();
  });

  it('uses the versionPrefix override', () => {
    render(<PublishHistoryList entries={[entries[0]]} versionPrefix="Rev" />);
    expect(screen.getByText('Rev 4.0.0')).toBeTruthy();
  });

  it('renders no dividers between rows, using zebra striping instead (matching the Overview tab grid)', () => {
    render(<PublishHistoryList entries={entries} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0].className).not.toContain('border-b');
    expect(rows[0].className).toContain('stripedRow');
    expect(rows[1].className).not.toContain('border-b');
    expect(rows[1].className).not.toContain('stripedRow');
  });
});
