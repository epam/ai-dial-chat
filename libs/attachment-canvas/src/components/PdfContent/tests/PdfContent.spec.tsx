import type { InputHighlightData } from '@epam/pdf-highlighter-kit';
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfContent } from '../PdfContent';

interface DocumentPreviewMockProps {
  onTotalPagesChange: (totalPages: number) => void;
  thumbnailPageNumbers: number[];
  onThumbnailsLoaded: (map: Map<number, string>) => void;
  onViewerReady: (api: { navigateToPage: (page: number) => void }) => void;
}

interface PageThumbnailMockProps {
  pageNum: number;
  onSelectPage: (pageNum: number) => void;
  isSelected: boolean;
  isLoading: boolean;
  thumbnailUrl: string | null;
}

interface FabButtonMockProps {
  icon: ReactNode;
  'aria-label': string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
}

interface DropdownMockProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderOverlay?: () => ReactNode;
}

interface InputMockProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  postfix?: string;
  'aria-label'?: string;
}

const documentPreviewState = vi.hoisted(() => {
  return { props: undefined as DocumentPreviewMockProps | undefined };
});

vi.mock('@epam/ai-dial-react-pdf-highlighter', () => ({
  DocumentPreview: (props: DocumentPreviewMockProps) => {
    documentPreviewState.props = props;
    return null;
  },
  PageThumbnail: ({
    pageNum,
    onSelectPage,
    isSelected,
    isLoading,
    thumbnailUrl,
  }: PageThumbnailMockProps) => (
    <button aria-pressed={isSelected} onClick={() => onSelectPage(pageNum)}>
      {isLoading ? `loading-${pageNum}` : `page-${pageNum}:${thumbnailUrl}`}
    </button>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Medium: 'medium', Large: 'large' },
  FabButton: ({
    icon,
    'aria-label': ariaLabel,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
  }: FabButtonMockProps) => (
    <button
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {icon}
    </button>
  ),
  Dropdown: ({
    children,
    open,
    onOpenChange,
    renderOverlay,
  }: DropdownMockProps) => (
    <div>
      <span
        role="button"
        tabIndex={0}
        onClick={() => onOpenChange?.(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenChange?.(!open);
        }}
      >
        {children}
      </span>
      {open && renderOverlay?.()}
    </div>
  ),
  Input: ({
    value,
    onChange,
    onBlur,
    onKeyDown,
    postfix,
    'aria-label': ariaLabel,
  }: InputMockProps) => (
    <label>
      {ariaLabel}
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <span>{postfix}</span>
    </label>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconMenu2: () => <svg />,
  IconX: () => <svg />,
}));

const makeHighlight = (id: string, page: number): InputHighlightData => ({
  id,
  bboxes: [{ page, x1: 0, y1: 0, x2: 1, y2: 1 }],
});

const openThumbnailsPanel = () => {
  fireEvent.click(screen.getByLabelText('Show thumbnails'));
};

const setTotalPages = (totalPages: number) => {
  act(() => {
    documentPreviewState.props?.onTotalPagesChange(totalPages);
  });
};

const getThumbnailPageNumbers = (): number[] => {
  const props = documentPreviewState.props;
  if (!props) throw new Error('DocumentPreview has not rendered yet');
  return props.thumbnailPageNumbers;
};

describe('PdfContent', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.useFakeTimers();
    // Run rAF callbacks synchronously so a scroll's setScrollTop lands
    // before the test's next assertion, without depending on whether this
    // vitest version's fake-timer clock also drives requestAnimationFrame.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders nothing when url is empty', () => {
    render(<PdfContent url="" highlights={[]} />);
    expect(documentPreviewState.props).toBeUndefined();
    expect(screen.queryByLabelText('Show thumbnails')).toBeNull();
  });

  describe('virtualization', () => {
    it('requests the eager first batch of thumbnails as soon as totalPages resolves', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      expect(getThumbnailPageNumbers()).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1),
      );
    });

    it('caps the eager batch at totalPages when the document is shorter than the batch size', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(5);
      expect(getThumbnailPageNumbers()).toEqual([1, 2, 3, 4, 5]);
    });

    it('renders only the visible window of thumbnails plus spacers, not every page', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      // itemHeight/panelHeight fall back to 172/400 until measured in jsdom
      // (no real layout), so the initial window covers pages 1-10.
      expect(screen.getByText(/^loading-1$/)).toBeTruthy();
      expect(screen.getByText(/^loading-10$/)).toBeTruthy();
      expect(screen.queryByText(/^loading-11$/)).toBeNull();
      expect(screen.queryByText(/^loading-50$/)).toBeNull();
    });

    it('extends the requested pages to the newly scrolled-to range, debounced, without dropping earlier pages', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      const panel = screen.getByRole('region', { name: 'Thumbnails' });
      fireEvent.scroll(panel, { target: { scrollTop: 172 * 30 } });

      act(() => {
        vi.runAllTimers();
      });

      const requested = getThumbnailPageNumbers();
      // Original eager batch (1-15) must still be present...
      expect(requested).toEqual(expect.arrayContaining([1, 15]));
      // ...and the newly scrolled-to pages around row 30 must be added too.
      expect(requested).toEqual(expect.arrayContaining([28, 31, 34]));
      expect(requested).toEqual([...requested].sort((a, b) => a - b));
    });

    it('does not change the requested pages when scrolling within an already-requested range', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      const panel = screen.getByRole('region', { name: 'Thumbnails' });
      fireEvent.scroll(panel, { target: { scrollTop: 5 } });

      act(() => {
        vi.runAllTimers();
      });

      expect(getThumbnailPageNumbers()).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1),
      );
    });
  });

  describe('scroll-to-selected-page', () => {
    it('does not scroll a closed panel', () => {
      render(
        <PdfContent
          url="doc.pdf"
          highlights={[makeHighlight('h1', 5)]}
          selectedHighlightId="h1"
        />,
      );
      setTotalPages(50);
      expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls the panel to a target computed from (selectedPage - 1) * itemHeight, centered', () => {
      render(
        <PdfContent
          url="doc.pdf"
          highlights={[makeHighlight('h1', 5)]}
          selectedHighlightId="h1"
        />,
      );
      setTotalPages(50);
      openThumbnailsPanel();

      // itemHeight fallback = 172, jsdom clientHeight = 0:
      // top = (5 - 1) * 172 - 0 / 2 + 172 / 2 = 774
      expect(Element.prototype.scrollTo).toHaveBeenCalledWith({
        top: 774,
        behavior: 'smooth',
      });
    });

    it('computes an unclamped target when the panel is short relative to the row height', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      // itemHeight fallback = 172, jsdom clientHeight = 0:
      // top = (1 - 1) * 172 - 0 / 2 + 172 / 2 = 86
      expect(Element.prototype.scrollTo).toHaveBeenCalledWith({
        top: 86,
        behavior: 'smooth',
      });
    });

    it('clamps the scroll target to 0 when it would otherwise be negative', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      fireEvent.click(screen.getByRole('button', { name: /^loading-3$/ }));

      const panel = screen.getByRole('region', { name: 'Thumbnails' });
      Object.defineProperty(panel, 'clientHeight', {
        value: 1000,
        configurable: true,
      });

      fireEvent.click(screen.getByRole('button', { name: /^loading-1$/ }));

      expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({
        top: 0,
        behavior: 'smooth',
      });
    });
  });

  describe('page navigator input', () => {
    it('navigates to a valid committed page number on Enter', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input.value).toBe('12');
      // Commits the same way a thumbnail click does: scrolls the panel to
      // the newly selected page — top = (12 - 1) * 172 + 172 / 2 = 1978.
      expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({
        top: 1978,
        behavior: 'smooth',
      });
    });

    it('resets to the current page when the committed value is out of range', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.blur(input);

      expect(input.value).toBe('1');
    });

    it('resets to the current page when the committed value is empty', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(input.value).toBe('1');
    });

    it('resets to the current page when the committed value is not an integer', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '3.5' } });
      fireEvent.blur(input);

      expect(input.value).toBe('1');
    });

    it('re-syncs the input value when selectedPage changes from a thumbnail click', () => {
      render(<PdfContent url="doc.pdf" highlights={[]} />);
      setTotalPages(50);
      openThumbnailsPanel();

      fireEvent.click(screen.getByRole('button', { name: /^loading-3$/ }));

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      expect(input.value).toBe('3');
    });
  });
});
