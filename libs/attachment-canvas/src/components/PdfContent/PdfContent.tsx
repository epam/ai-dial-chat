import { mergeClasses, useIsMobile } from '@epam/ai-dial-chat-shared';
import type { PdfViewerApi } from '@epam/ai-dial-react-pdf-highlighter';
import {
  DocumentPreview,
  PageThumbnail,
} from '@epam/ai-dial-react-pdf-highlighter';
import type { InputHighlightData } from '@epam/pdf-highlighter-kit';
import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchBlobFromUrl } from '../../utils/download';
import styles from './PdfContent.module.scss';

const THUMBNAIL_OVERSCAN = 5;
/* Conservative fallback used until the first item is measured. Overestimates
 * to avoid rendering too many items before the real height is known. */
const THUMBNAIL_HEIGHT_FALLBACK = 200;

/** Props for the `PdfContent` component. */
export interface PdfContentProps {
  /** URL of the PDF file to display. */
  url: string;
  /** Highlight annotations to overlay on the document. */
  highlights: InputHighlightData[];
  /** ID of the highlight that should be scrolled into view on mount. */
  selectedHighlightId?: string;
  /** Custom fetcher for the PDF blob; falls back to a plain `fetch` wrapper. */
  loadPdf?: (url: string) => Promise<Blob>;
  /** File name shown in the canvas header. */
  fileName?: string;
  /**
   * Hides the underlying `DocumentPreview`'s own title/zoom toolbar row —
   * for hosts that render their own header and don't want it duplicated.
   * `DocumentPreview` (`@epam/ai-dial-react-pdf-highlighter`) has no public
   * prop for this, so it is done via `containerClassName` targeting that
   * row's structural position; this only holds while `PdfContent` itself
   * never passes `title`/`fileName` through to `DocumentPreview` (it
   * currently doesn't — see the unused `fileName` prop above). Defaults to
   * `false`, preserving the existing chat sidebar canvas's appearance.
   */
  hideHeader?: boolean;
}

/** Renders a PDF with highlight annotations, a sidebar thumbnail strip, and page navigation. */
export const PdfContent: FC<PdfContentProps> = ({
  url,
  highlights,
  selectedHighlightId,
  loadPdf,
  hideHeader = false,
}) => {
  const isMobile = useIsMobile();
  const [totalPages, setTotalPages] = useState(0);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [selectedPage, setSelectedPage] = useState(() => {
    if (!selectedHighlightId) return 1;
    const match = highlights.find((h) => h.id === selectedHighlightId);
    return match?.bboxes[0]?.page ?? 1;
  });

  const viewerApiRef = useRef<PdfViewerApi | null>(null);
  const thumbnailNodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const thumbnailObserverRef = useRef<IntersectionObserver | null>(null);
  const [requestedThumbnailPages, setRequestedThumbnailPages] = useState<
    number[]
  >([]);

  /* Virtual sidebar state — avoid mounting 200+ PageThumbnail instances at once. */
  const sidebarRef = useRef<HTMLDivElement>(null);
  const itemHeightRef = useRef(THUMBNAIL_HEIGHT_FALLBACK);
  const [itemHeight, setItemHeight] = useState(THUMBNAIL_HEIGHT_FALLBACK);
  const [scrollTop, setScrollTop] = useState(0);
  const [sidebarHeight, setSidebarHeight] = useState(600);

  useEffect(() => {
    if (!selectedHighlightId) return;
    const match = highlights.find((h) => h.id === selectedHighlightId);
    const page = match?.bboxes[0]?.page;
    if (page != null) setSelectedPage(page);
  }, [selectedHighlightId, highlights]);

  /* Scroll to the selected page thumbnail. When it is outside the virtual
   * window and not yet mounted, scroll the container to its approximate
   * position — the element will mount on the next render and become visible. */
  useEffect(() => {
    const el = thumbnailNodeRefs.current.get(selectedPage);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (sidebarRef.current) {
      sidebarRef.current.scrollTo({
        top: (selectedPage - 1) * itemHeightRef.current,
        behavior: 'smooth',
      });
    }
  }, [selectedPage, totalPages]);

  const allPageNumbers = useMemo(
    () => (isMobile ? [] : Array.from({ length: totalPages }, (_, i) => i + 1)),
    [isMobile, totalPages],
  );

  /*
   * Request thumbnail renders only for pages visible (or within 300 px of)
   * the sidebar viewport. Passing all page numbers at once causes the library
   * to queue every render upfront; when the canvas closes mid-queue the PDF.js
   * instance is already destroyed before later batches start, producing
   * "No PDF document loaded" errors.
   */
  useEffect(() => {
    setRequestedThumbnailPages([]);

    if (allPageNumbers.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const newPages = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.page))
          .filter((n) => n > 0);
        if (newPages.length === 0) return;
        setRequestedThumbnailPages((prev) => {
          const seen = new Set(prev);
          const toAdd = newPages.filter((p) => !seen.has(p));
          return toAdd.length === 0 ? prev : [...prev, ...toAdd];
        });
      },
      { rootMargin: '300px 0px' },
    );

    thumbnailObserverRef.current = observer;
    thumbnailNodeRefs.current.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      thumbnailObserverRef.current = null;
    };
  }, [allPageNumbers]);

  /* Track sidebar scroll position and height for virtual windowing. */
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;

    setSidebarHeight(el.clientHeight);

    const ro = new ResizeObserver(() => setSidebarHeight(el.clientHeight));
    ro.observe(el);

    const handleScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', handleScroll);
    };
  }, [totalPages]);

  /*
   * Pass only pages whose thumbnail has not yet been rendered. The library's
   * effect restarts from page 1 whenever `thumbnailPageNumbers` changes — if
   * we pass the full accumulated list, every scroll event re-renders every
   * previously-loaded thumbnail. Filtering to pending pages means the library
   * only ever renders new work.
   */
  const pendingThumbnailPages = useMemo(
    () => requestedThumbnailPages.filter((p) => !thumbnails.has(p)),
    [requestedThumbnailPages, thumbnails],
  );

  const handleThumbnailsLoaded = useCallback((map: Map<number, string>) => {
    setThumbnails((prev) => new Map([...prev, ...map]));
  }, []);

  const handleViewerReady = useCallback((api: PdfViewerApi) => {
    viewerApiRef.current = api;
  }, []);

  const handleSelectPage = useCallback((pageNum: number) => {
    setSelectedPage(pageNum);
    viewerApiRef.current?.navigateToPage(pageNum);
  }, []);

  /* Virtual window: only mount PageThumbnail components near the visible area.
   * Padding spacers preserve total scroll height so the scrollbar stays accurate. */
  const startIdx = Math.max(
    0,
    Math.floor(scrollTop / itemHeight) - THUMBNAIL_OVERSCAN,
  );
  const endIdx = Math.min(
    allPageNumbers.length - 1,
    Math.ceil((scrollTop + sidebarHeight) / itemHeight) +
      THUMBNAIL_OVERSCAN -
      1,
  );
  const paddingTop = startIdx * itemHeight;
  const paddingBottom = Math.max(
    0,
    (allPageNumbers.length - 1 - endIdx) * itemHeight,
  );

  if (!url) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {totalPages > 0 && (
        <div
          ref={sidebarRef}
          className="w-30 me-1 shrink-0 overflow-auto pe-0.5 mobile:hidden"
        >
          <div style={{ paddingTop, paddingBottom }}>
            {allPageNumbers
              .slice(startIdx, endIdx + 1)
              .map((pageNum, sliceIdx) => (
                <div
                  key={pageNum}
                  data-page={pageNum}
                  ref={(el) => {
                    if (el) {
                      /* Measure real item height from the first rendered element so
                       * the virtual window calculation stays accurate. */
                      if (
                        sliceIdx === 0 &&
                        startIdx === 0 &&
                        itemHeightRef.current === THUMBNAIL_HEIGHT_FALLBACK
                      ) {
                        const h = el.getBoundingClientRect().height;
                        if (h > 0) {
                          itemHeightRef.current = h;
                          setItemHeight(h);
                        }
                      }
                      thumbnailNodeRefs.current.set(pageNum, el);
                      thumbnailObserverRef.current?.observe(el);
                    } else {
                      thumbnailNodeRefs.current.delete(pageNum);
                    }
                  }}
                >
                  <PageThumbnail
                    pageNum={pageNum}
                    onSelectPage={handleSelectPage}
                    isSelected={selectedPage === pageNum}
                    isLoading={!thumbnails.has(pageNum)}
                    thumbnailUrl={thumbnails.get(pageNum) ?? null}
                  />
                </div>
              ))}
          </div>
        </div>
      )}
      <div
        className={mergeClasses('min-w-0 flex-1 overflow-auto', styles.viewer)}
      >
        <DocumentPreview
          fileUrl={url}
          loadFileCb={loadPdf ?? fetchBlobFromUrl}
          highlights={highlights}
          selectedHighlightId={selectedHighlightId}
          showOccurrences={false}
          onTotalPagesChange={setTotalPages}
          thumbnailPageNumbers={pendingThumbnailPages}
          onThumbnailsLoaded={handleThumbnailsLoaded}
          onViewerReady={handleViewerReady}
          containerClassName={
            hideHeader ? '[&>div:first-child]:hidden' : undefined
          }
        />
      </div>
    </div>
  );
};
