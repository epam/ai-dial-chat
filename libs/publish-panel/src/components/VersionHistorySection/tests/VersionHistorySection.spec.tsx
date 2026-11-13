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
    status: VersionHistoryStatus.NotPublished,
    folder: 'Personal / Design',
    modifiedAt: '20 Jul 2026',
    author: 'by Ivan Petrov',
  },
  {
    id: 'b',
    version: '1.0.0',
    status: VersionHistoryStatus.Published,
    folder: 'Personal / Design',
    modifiedAt: '12 Jul 2026',
    author: 'Published by Jane Doe',
  },
  {
    id: 'c',
    version: '1.1.0',
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

  it('reads the In review and Published statuses as text and draws no badge for a not published version', () => {
    renderSection();

    expect(screen.getByText('In review')).toBeTruthy();
    expect(screen.getByText('Published')).toBeTruthy();
    expect(screen.queryByText('Not published')).toBeNull();
    const [first] = screen.getAllByRole('listitem');
    expect(within(first).getByText('beta-2')).toBeTruthy();
    expect(within(first).getByText('20 Jul 2026')).toBeTruthy();
  });

  it('shows the folder, the date and the author of a row on separate parts', () => {
    renderSection();

    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).getByText('Personal / Design')).toBeTruthy();
    expect(within(first).getByText('20 Jul 2026')).toBeTruthy();
    expect(within(first).getByText('by Ivan Petrov')).toBeTruthy();
    expect(within(second).getByText('12 Jul 2026')).toBeTruthy();
    expect(within(second).getByText('Published by Jane Doe')).toBeTruthy();
  });

  it('keeps the loading message out of the list while statuses load', () => {
    renderSection({
      rows: [{ id: 'a', version: '1.0.0' }],
      isLoading: true,
    });

    const item = screen.getByRole('listitem');
    expect(within(item).queryByText(/Loading publication statuses/)).toBeNull();
    expect(screen.getByText('Loading publication statuses…')).toBeTruthy();
  });

  it('offers no action on a row', () => {
    renderSection();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows no status for a row whose status has not loaded yet', () => {
    renderSection({ rows: [{ id: 'a', version: '1.0.0' }] });

    expect(screen.queryByText('Not published')).toBeNull();
    expect(screen.queryByText('Published')).toBeNull();
  });

  it('keeps the first line of every row at the badge height so a loaded row does not change height', () => {
    renderSection({
      rows: [
        { id: 'a', version: '1.0.0' },
        {
          id: 'b',
          version: '2.0.0',
          status: VersionHistoryStatus.NotPublished,
        },
      ],
    });

    screen.getAllByRole('listitem').forEach((item) => {
      expect(item.firstElementChild?.className).toMatch(/min-h-6/);
    });
  });

  it('does not present an unknown status as Not published', () => {
    renderSection({
      rows: [
        {
          id: 'a',
          version: '1.0.0',
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

  it('announces loading when the section opens already loading, after the region is mounted', () => {
    renderSection({ isLoading: true });

    const region = screen.getAllByRole('status')[0];
    expect(region.textContent).toBe('Loading publication statuses…');
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
      labels: { heading: 'Historia', inReviewLabel: 'En revisión' },
    });

    expect(screen.getByRole('heading', { name: 'Historia' })).toBeTruthy();
    expect(screen.getByText('En revisión')).toBeTruthy();
  });

  it('renders at phone width without a fixed width on a row', () => {
    window.innerWidth = 375;
    renderSection();

    const item = screen.getAllByRole('listitem')[0];
    expect(item.getAttribute('style')).toBeNull();
  });
});
