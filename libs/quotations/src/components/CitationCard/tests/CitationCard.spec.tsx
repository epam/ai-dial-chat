import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import { CitationCard } from '../CitationCard';

const makeGroup = (
  count = 1,
  attachmentType = 'application/pdf',
  title?: string,
): AnnotationGroup => ({
  sourceUrl: 'https://files.example.com/report.pdf',
  sourceName: 'report.pdf',
  annotations: Array.from({ length: count }, (_, i) => ({
    index: i,
    body: {
      title: title ?? `Title ${i}`,
      quote: `Quote ${i}`,
      source: {
        type: 'attachment' as const,
        attachment: {
          type: attachmentType,
          url: 'https://files.example.com/report.pdf',
        },
      },
    },
  })),
  get primaryAnnotation() {
    return this.annotations[0];
  },
});

const defaultLabels = {
  ariaLabel: 'Citation from report.pdf',
  previousCitation: 'Previous',
  nextCitation: 'Next',
  formatSwitcherText: (current: number, total: number) =>
    `${current} / ${total}`,
  preview: 'Preview',
  openInBrowser: 'Open in browser',
  download: 'Download',
};

const defaultProps = (
  overrides: Partial<Parameters<typeof CitationCard>[0]> = {},
) => ({
  group: makeGroup(),
  activeIndex: 0,
  onIndexChange: vi.fn(),
  onPreview: vi.fn(),
  onOpenInBrowser: vi.fn(),
  labels: defaultLabels,
  ...overrides,
});

describe('CitationCard', () => {
  it('renders with role="dialog"', () => {
    render(<CitationCard {...defaultProps()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('hides the switcher when there is only one annotation', () => {
    render(<CitationCard {...defaultProps({ group: makeGroup(1) })} />);
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeFalsy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeFalsy();
  });

  it('shows the switcher when there are multiple annotations', () => {
    render(
      <CitationCard
        {...defaultProps({
          group: makeGroup(3),
          activeIndex: 0,
        })}
      />,
    );
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('calls onIndexChange with incremented index when next is clicked', async () => {
    const onIndexChange = vi.fn();
    render(
      <CitationCard
        {...defaultProps({
          group: makeGroup(3),
          activeIndex: 0,
          onIndexChange,
        })}
      />,
    );
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    await userEvent.click(nextBtn);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('renders body title and quote for the active annotation', () => {
    const group = makeGroup(1);
    render(<CitationCard {...defaultProps({ group })} />);
    expect(screen.getByText('Title 0')).toBeTruthy();
    expect(screen.getByText('Quote 0')).toBeTruthy();
  });

  it('"Preview" button calls onPreview with the active annotation', async () => {
    const onPreview = vi.fn();
    const group = makeGroup(1);
    render(<CitationCard {...defaultProps({ group, onPreview })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onPreview).toHaveBeenCalledWith(group.annotations[0]);
  });

  it('"Open in browser" button calls onOpenInBrowser with the active annotation', async () => {
    const onOpenInBrowser = vi.fn();
    const group = makeGroup(1, 'text/html');
    render(<CitationCard {...defaultProps({ group, onOpenInBrowser })} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Open in browser' }),
    );
    expect(onOpenInBrowser).toHaveBeenCalledWith(group.annotations[0]);
  });

  it('hides the Preview button when onPreview is omitted', () => {
    const group = makeGroup(1, 'application/pdf');
    render(<CitationCard {...defaultProps({ group, onPreview: undefined })} />);
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeFalsy();
    expect(
      screen.getByRole('button', { name: 'Open in browser' }),
    ).toBeTruthy();
  });

  it('calls onOpenInBrowser when onPreview is omitted', async () => {
    const onOpenInBrowser = vi.fn();
    const group = makeGroup(1, 'application/pdf');
    render(
      <CitationCard
        {...defaultProps({ group, onPreview: undefined, onOpenInBrowser })}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Open in browser' }),
    );
    expect(onOpenInBrowser).toHaveBeenCalledWith(group.annotations[0]);
  });

  /* The quoted excerpt is line-clamped, so its overflow is hidden — an
   * unbreakable URL that cannot wrap gets cut off at the card's edge. Wrapping
   * inside the quote comes from `MarkdownRenderer`'s own base classes and is
   * asserted in its spec; the title below is rendered by this component. */
  it('keeps a long unbroken title wrappable', () => {
    const group = makeGroup(
      1,
      'application/pdf',
      'ReallyLongUnbrokenTitleTokenThatWouldOtherwiseOverflowTheFixedWidthCard',
    );

    const { container } = render(<CitationCard {...defaultProps({ group })} />);

    const title = container.querySelectorAll('p')[0];
    expect(title.className).toContain('break-words');
  });
});
