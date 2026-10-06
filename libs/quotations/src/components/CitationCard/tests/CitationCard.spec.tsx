import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUOTATIONS_CLASS } from '../../../constants/public-class-names';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import { CitationCard } from '../CitationCard';

/* jsdom has no layout; report every table as wider than its scroll container
 * so `MarkdownTable` exposes its labelled scroll region. */
const mockOverflowingTables = () => {
  vi.spyOn(HTMLDivElement.prototype, 'scrollWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLDivElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(HTMLTableElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, right: 400 } as DOMRect,
  );
};

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  FileIcon: ({ fileExtension }: { fileExtension?: string }) => (
    <span data-testid="file-icon" data-extension={fileExtension} />
  ),
}));

const makeGroup = (
  count = 1,
  attachmentType = 'application/pdf',
  title?: string,
  quote?: string,
): AnnotationGroup => ({
  groupKey: 'https://files.example.com/report.pdf',
  sourceUrl: 'https://files.example.com/report.pdf',
  sourceName: 'report.pdf',
  annotations: Array.from({ length: count }, (_, i) => ({
    index: i,
    body: {
      title: title ?? `Title ${i}`,
      quote: quote ?? `Quote ${i}`,
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
  showMore: 'Show more',
  showLess: 'Show less',
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

  it('shows Preview and Download, with no Open in browser, for a previewable file', async () => {
    const onOpenInBrowser = vi.fn();
    const props = defaultProps({ onOpenInBrowser });
    render(<CitationCard {...props} />);
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Open in browser' }),
    ).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onOpenInBrowser).toHaveBeenCalledWith(props.group.annotations[0]);
  });

  it('hides Download for a previewable file when isDownloadEnabled is false', () => {
    render(<CitationCard {...defaultProps({ isDownloadEnabled: false })} />);
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('keeps Open in browser for a web link when isDownloadEnabled is false', () => {
    render(
      <CitationCard
        {...defaultProps({
          group: makeGroup(1, 'text/html'),
          isDownloadEnabled: false,
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Open in browser' }),
    ).toBeTruthy();
  });

  it('shows the file extension in the header for a previewable file', () => {
    render(<CitationCard {...defaultProps()} />);
    expect(screen.getByText('.pdf')).toBeTruthy();
    expect(screen.queryByText('report.pdf')).toBeNull();
  });

  it('draws the file-type icon for a previewable file by default', () => {
    render(<CitationCard {...defaultProps()} />);
    expect(screen.getByTestId('file-icon').dataset.extension).toBe('.pdf');
  });

  it('uses the host headerIcon instead of the default file-type icon', () => {
    render(
      <CitationCard
        {...defaultProps({ headerIcon: <span data-testid="host-icon" /> })}
      />,
    );
    expect(screen.getByTestId('host-icon')).toBeTruthy();
    expect(screen.queryByTestId('file-icon')).toBeNull();
  });

  it('draws no header icon for a web link', () => {
    render(
      <CitationCard {...defaultProps({ group: makeGroup(1, 'text/html') })} />,
    );
    expect(screen.queryByTestId('file-icon')).toBeNull();
  });

  it('shows the source name in the header for a web link', () => {
    render(
      <CitationCard {...defaultProps({ group: makeGroup(1, 'text/html') })} />,
    );
    expect(screen.getByText('report.pdf')).toBeTruthy();
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

    render(<CitationCard {...defaultProps({ group })} />);

    const title = screen.getByText(
      'ReallyLongUnbrokenTitleTokenThatWouldOtherwiseOverflowTheFixedWidthCard',
    );
    expect(title.className).toContain('break-words');
  });
});

/* jsdom does no layout, so `scrollHeight`/`clientHeight` are both 0 unless a
 * test stubs them to simulate a quote that overflows its line clamp. */
const stubQuoteOverflow = (overflowing: boolean) => {
  const scrollHeight = vi
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockReturnValue(overflowing ? 400 : 100);
  const clientHeight = vi
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(100);
  return () => {
    scrollHeight.mockRestore();
    clientHeight.mockRestore();
  };
};

describe('CitationCard — long quotes', () => {
  let restore: () => void = () => undefined;

  afterEach(() => restore());

  it('hides the toggle when the quote fits', () => {
    restore = stubQuoteOverflow(false);
    render(<CitationCard {...defaultProps()} />);

    expect(screen.queryByRole('button', { name: 'Show more' })).toBeFalsy();
  });

  it('expands a clamped quote into a scrollable region and collapses it back', async () => {
    restore = stubQuoteOverflow(true);
    render(<CitationCard {...defaultProps()} />);

    const toggle = screen.getByRole('button', { name: 'Show more' });
    // eslint-disable-next-line testing-library/no-node-access -- the quote is the unlabeled region the toggle's aria-controls points at; it has no role or name to query
    const quote = document.getElementById(
      toggle.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    expect(quote.textContent).toContain('Quote 0');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(quote.className).toContain('line-clamp-6');

    await userEvent.click(toggle);

    const collapse = screen.getByRole('button', { name: 'Show less' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(quote.className).not.toContain('line-clamp-6');
    expect(quote.className).toContain('overflow-y-auto');
    expect(quote.tabIndex).toBe(0);

    await userEvent.click(collapse);

    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(quote.className).toContain('line-clamp-6');
  });

  it('collapses again when switching to another citation', async () => {
    restore = stubQuoteOverflow(true);
    const props = defaultProps({ group: makeGroup(2) });
    const { rerender } = render(<CitationCard {...props} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    rerender(<CitationCard {...props} activeIndex={1} />);

    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
  });
});

describe('CitationCard — public class names', () => {
  it('stamps the card root', () => {
    render(<CitationCard {...defaultProps()} />);

    expect(screen.getByRole('dialog').classList).toContain(
      QUOTATIONS_CLASS.citationCard,
    );
  });
});

describe('CitationCard — quote markdown labels', () => {
  it('names the quote code-block buttons with the host labels', () => {
    const group = makeGroup(
      1,
      'application/pdf',
      undefined,
      '```ts\nconst a = 1;\n```',
    );

    render(
      <CitationCard
        {...defaultProps({
          group,
          labels: {
            ...defaultLabels,
            codeBlockCopyLabel: 'Kopieren',
            codeBlockDownloadLabel: 'Herunterladen',
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Herunterladen' })).toBeTruthy();
  });
});

describe('CitationCard — quote table label', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names an overflowing quote table scroll region with the host label', () => {
    mockOverflowingTables();
    const group = makeGroup(
      1,
      'application/pdf',
      undefined,
      '| a | b |\n| - | - |\n| 1 | 2 |',
    );

    render(
      <CitationCard
        {...defaultProps({
          group,
          labels: {
            ...defaultLabels,
            tableScrollRegionAriaLabel: 'Scrollbare Tabelle',
          },
        })}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Scrollbare Tabelle' }),
    ).toBeTruthy();
  });
});
