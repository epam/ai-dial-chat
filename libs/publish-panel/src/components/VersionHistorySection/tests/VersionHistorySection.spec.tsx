import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  VersionHistoryStatus,
  type VersionHistoryRow,
  type VersionHistorySectionProps,
} from '../../../models/version-history';
import { VersionHistorySection } from '../VersionHistorySection';

const rows: VersionHistoryRow[] = [
  {
    id: 'a',
    version: 'beta-2',
    isCurrent: false,
    status: VersionHistoryStatus.NotPublished,
    folder: 'Personal / Design',
    modifiedAt: '20 Jul 2026',
    author: 'by Ivan Petrov',
  },
  {
    id: 'b',
    version: '1.0.0',
    isCurrent: true,
    status: VersionHistoryStatus.Published,
    publishedFolders: ['Organization/Design', 'Organization'],
    folder: 'Personal / Design',
    modifiedAt: '12 Jul 2026',
    author: 'Published by Jane Doe',
  },
  {
    id: 'c',
    version: '1.1.0',
    isCurrent: false,
    status: VersionHistoryStatus.InReview,
  },
];

const renderSection = (props?: Partial<VersionHistorySectionProps>) =>
  render(<VersionHistorySection rows={rows} {...props} />);

describe('VersionHistorySection', () => {
  it('renders a headed list with one item per row, in the given order', () => {
    renderSection();

    expect(
      screen.getByRole('heading', { name: 'Versions history' }),
    ).toBeTruthy();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('beta-2'),
      expect.stringContaining('1.0.0'),
      expect.stringContaining('1.1.0'),
    ]);
  });

  it('marks only the current version', () => {
    renderSection();

    expect(screen.getAllByText('Current')).toHaveLength(1);
    const [, second] = screen.getAllByRole('listitem');
    expect(within(second).getByText('Current')).toBeTruthy();
  });

  it('reads each status as text, with the folders of a published version', () => {
    renderSection();

    expect(screen.getByText('Not published')).toBeTruthy();
    expect(screen.getByText('In review')).toBeTruthy();
    expect(
      screen.getByText('Published in Organization/Design, Organization'),
    ).toBeTruthy();
  });

  it('shows the folder, the date and the author line of a row', () => {
    renderSection();

    expect(
      screen.getByText(
        'Personal / Design · 12 Jul 2026 · Published by Jane Doe',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Personal / Design · 20 Jul 2026 · by Ivan Petrov'),
    ).toBeTruthy();
  });

  it('offers no action on a row', () => {
    renderSection();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows no status for a row whose status has not loaded yet', () => {
    renderSection({ rows: [{ id: 'a', version: '1.0.0', isCurrent: false }] });

    expect(screen.queryByText('Not published')).toBeNull();
  });

  it('does not present an unknown status as Not published', () => {
    renderSection({
      rows: [
        {
          id: 'a',
          version: '1.0.0',
          isCurrent: false,
          status: VersionHistoryStatus.Unknown,
        },
      ],
    });

    expect(screen.queryByText('Not published')).toBeNull();
    expect(screen.getByText('Status unavailable')).toBeTruthy();
  });

  it('shows the empty state when there are no rows', () => {
    renderSection({ rows: [] });

    expect(screen.getByText('No saved versions yet.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('announces loading through a live region that was mounted before its text', () => {
    const { rerender } = renderSection();
    const regions = screen.getAllByRole('status');
    const region = regions[0];
    expect(region.textContent).toBe('');

    rerender(<VersionHistorySection rows={rows} isLoading />);

    expect(screen.getAllByRole('status')[0]).toBe(region);
    expect(region.textContent).toBe('Loading publication statuses…');
  });

  it('keeps the rows on error and retries through the host callback', () => {
    const onRetry = vi.fn();
    renderSection({ hasError: true, onRetry });

    expect(
      screen.getByText('Could not load publication statuses.'),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('takes every string from labels', () => {
    renderSection({
      labels: { heading: 'Historia', currentLabel: 'Actual' },
    });

    expect(screen.getByRole('heading', { name: 'Historia' })).toBeTruthy();
    expect(screen.getByText('Actual')).toBeTruthy();
  });

  it('renders at phone width without a fixed width on a row', () => {
    window.innerWidth = 375;
    renderSection();

    const item = screen.getAllByRole('listitem')[0];
    expect(item.getAttribute('style')).toBeNull();
  });
});
