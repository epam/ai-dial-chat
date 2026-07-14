import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublishHistoryEntry } from '../../../models/publish';
import { PublishHistoryList } from '../PublishHistoryList';

const DAY_MS = 24 * 60 * 60 * 1000;

const entries: PublishHistoryEntry[] = [
  {
    version: '4.0.0',
    publishedAt: Date.now() - 3 * DAY_MS,
    publishedBy: 'you',
    folderPath: ['Shared', 'Data Science', 'Published models'],
  },
  {
    version: '3.9.0',
    publishedAt: Date.now() - 90 * DAY_MS,
    publishedBy: 'A. Ivanov',
    folderPath: ['Shared', 'Production'],
  },
];

describe('PublishHistoryList', () => {
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

  it('renders a relative date within the last week', () => {
    render(<PublishHistoryList entries={[entries[0]]} />);
    expect(screen.getByText(/3 days ago/)).toBeTruthy();
  });

  it('renders an exact date once older than a week', () => {
    render(<PublishHistoryList entries={[entries[1]]} />);
    expect(screen.queryByText(/days ago/)).toBeNull();
    expect(screen.getByText(/[A-Z][a-z]{2} \d{1,2}, \d{4}/)).toBeTruthy();
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
    expect(rows[0].className).toContain('bg-layer-2');
    expect(rows[1].className).not.toContain('border-b');
    expect(rows[1].className).not.toContain('bg-layer-2');
  });
});
