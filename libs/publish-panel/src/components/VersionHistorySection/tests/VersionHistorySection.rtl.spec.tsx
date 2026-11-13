import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  VersionHistoryStatus,
  type VersionHistoryRow,
} from '../../../models/version-history';
import { VersionHistorySection } from '../VersionHistorySection';

const PHYSICAL_DIRECTION_CLASS =
  /(^|\s)(ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)(-|\s|$)/;

const rows: VersionHistoryRow[] = [
  {
    id: 'a',
    version: '1.0.0',
    status: VersionHistoryStatus.Published,
    publishedIn: 'Published in Organization',
    folder: 'Personal',
    modifiedAt: '12 Jul 2026',
    author: 'Published by Jane Doe',
  },
];

describe('VersionHistorySection — RTL and accessibility', () => {
  it('renders under a right-to-left ancestor', () => {
    render(
      <div dir="rtl">
        <VersionHistorySection rows={rows} />
      </div>,
    );

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();
  });

  it('uses no physical-direction class on the section, heading, list or rows', () => {
    render(<VersionHistorySection rows={rows} hasError onRetry={vi.fn()} />);

    const elements = [
      screen.getByRole('region'),
      screen.getByRole('heading'),
      screen.getByRole('list'),
      screen.getByRole('listitem'),
    ];
    const offenders = elements
      .map((element) => element.getAttribute('class') ?? '')
      .filter((className) => PHYSICAL_DIRECTION_CLASS.test(className));
    expect(offenders).toEqual([]);
  });

  it('names the region by its heading and carries every status as text', () => {
    render(<VersionHistorySection rows={rows} />);

    expect(
      screen.getByRole('region', { name: 'Versions history' }),
    ).toBeTruthy();
    expect(screen.getByText('Published in Organization')).toBeTruthy();
  });

  it('keeps a 64-character version on one line and cuts it with an ellipsis', () => {
    render(
      <VersionHistorySection
        rows={[{ ...rows[0], version: 'a'.repeat(64) }]}
      />,
    );

    const version = screen.getByText('a'.repeat(64));
    expect(version.className).toMatch(/truncate/);
    expect(version.className).not.toMatch(/wrap-anywhere/);
  });
});
