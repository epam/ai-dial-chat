import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { PdfViewerApi } from '@epam/ai-dial-react-pdf-highlighter';
import {
  DocumentPreview,
  PageThumbnail,
} from '@epam/ai-dial-react-pdf-highlighter';
import {
  DIAL_ICON_SIZE,
  Dropdown,
  ElementSize,
  FabButton,
  Input,
} from '@epam/ai-dial-ui-kit';
import type { InputHighlightData } from '@epam/pdf-highlighter-kit';
import { IconMenu2, IconX } from '@tabler/icons-react';
import {
  type FC,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchBlobFromUrl } from '../../utils/download';
import styles from './PdfContent.module.scss';

/** User-visible strings for the collapsible thumbnails section. */
export interface PdfContentLabels {
  /** Accessible name for the thumbnails region — not shown visibly. Defaults to `'Thumbnails'`. */
  thumbnailsLabel?: string;
  /** Accessible label for the FAB button when the thumbnails panel is closed. Defaults to `'Show thumbnails'`. */
  showThumbnailsLabel?: string;
  /** Accessible label for the FAB button when the thumbnails panel is open. Defaults to `'Hide thumbnails'`. */
  hideThumbnailsLabel?: string;
  /** Accessible label for the current-page number input at the top of the thumbnails panel. Defaults to `'Page number'`. */
  pageNumberLabel?: string;
}

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
  /** User-visible strings for the thumbnails section. All fields have English defaults. */
  labels?: PdfContentLabels;
}

/** Renders a PDF with highlight annotations, a floating collapsible thumbnails panel, and page navigation. */
export const PdfContent: FC<PdfContentProps> = ({
  url,
  highlights,
  selectedHighlightId,
  loadPdf,
  hideHeader = false,
  labels: {
    thumbnailsLabel = 'Thumbnails',
    showThumbnailsLabel = 'Show thumbnails',
    hideThumbnailsLabel = 'Hide thumbnails',
    pageNumberLabel = 'Page number',
  } = {},
}) => {
  const thumbnailsRegionId = useId();
  const [totalPages, setTotalPages] = useState(0);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState(() => {
    if (!selectedHighlightId) return 1;
    const match = highlights.find((h) => h.id === selectedHighlightId);
    return match?.bboxes[0]?.page ?? 1;
  });

  const viewerApiRef = useRef<PdfViewerApi | null>(null);
  const thumbnailNodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const [requestedThumbnailPages, setRequestedThumbnailPages] = useState<
    number[]
  >([]);

  useEffect(() => {
    if (!selectedHighlightId) return;
    const match = highlights.find((h) => h.id === selectedHighlightId);
    const page = match?.bboxes[0]?.page;
    if (page != null) setSelectedPage(page);
  }, [selectedHighlightId, highlights]);

  /*
   * Scroll to the selected page thumbnail by setting `scrollTop` on the
   * panel directly, rather than `Element.scrollIntoView()`. The panel is
   * rendered through the `Dropdown`'s portal with floating-ui's
   * `position: fixed` placement, which isn't anchored to any ancestor's
   * scroll offset — `scrollIntoView`'s ancestor walk doesn't recognize
   * that boundary and falls through to scrolling the real `<html>` root
   * instead of the (visually unmoving) fixed panel.
   */
  useEffect(() => {
    const container = panelRef.current;
    const el = thumbnailNodeRefs.current.get(selectedPage);
    if (!container || !el) return;
    container.scrollTo({
      top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
      behavior: 'smooth',
    });
  }, [selectedPage, totalPages, isThumbnailsOpen]);

  const allPageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages],
  );

  /*
   * Request every page's thumbnail as soon as the document finishes
   * loading, even while the section is still collapsed, so it's ready by
   * the time the user opens it. The vendor library batches these requests
   * internally (15 pages per batch) and reports each batch via
   * `onThumbnailsLoaded` as it completes, so pages render progressively
   * rather than all at once.
   */
  useEffect(() => {
    if (totalPages === 0) return;
    setRequestedThumbnailPages(
      Array.from({ length: totalPages }, (_, i) => i + 1),
    );
  }, [totalPages]);

  const handleThumbnailsLoaded = useCallback((map: Map<number, string>) => {
    setThumbnails((prev) => new Map([...prev, ...map]));
  }, []);

  const [isViewerReady, setIsViewerReady] = useState(false);

  const handleViewerReady = useCallback((api: PdfViewerApi) => {
    viewerApiRef.current = api;
    setIsViewerReady(true);
  }, []);

  /*
   * On initial load with no highlight/page requested, explicitly scroll to
   * the top of page 1 instead of trusting wherever the viewer's own initial
   * layout lands — deferred by a frame so it runs after the viewer's first
   * layout pass (page containers sized, virtual scrolling initialized)
   * rather than racing it.
   */
  useEffect(() => {
    if (!isViewerReady || selectedHighlightId) return;
    const raf = requestAnimationFrame(() => {
      viewerApiRef.current?.navigateToPage(1);
    });
    return () => cancelAnimationFrame(raf);
  }, [isViewerReady, selectedHighlightId]);

  const handleSelectPage = useCallback((pageNum: number) => {
    setSelectedPage(pageNum);
    viewerApiRef.current?.navigateToPage(pageNum);
  }, []);

  /* Current-page input state, kept separate from `selectedPage` so the user
   * can freely edit/clear the field before committing a valid page number. */
  const [pageInputValue, setPageInputValue] = useState(() =>
    String(selectedPage),
  );

  useEffect(() => {
    setPageInputValue(String(selectedPage));
  }, [selectedPage]);

  const commitPageInput = useCallback(
    (raw: string) => {
      const parsed = Number(raw);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= totalPages) {
        handleSelectPage(parsed);
      } else {
        setPageInputValue(String(selectedPage));
      }
    },
    [totalPages, selectedPage, handleSelectPage],
  );

  if (!url) return null;

  const thumbnailItems = allPageNumbers.map((pageNum) => (
    <div
      key={pageNum}
      ref={(el) => {
        if (el) {
          thumbnailNodeRefs.current.set(pageNum, el);
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
  ));

  return (
    <div className="relative flex h-full overflow-hidden">
      {totalPages > 0 && (
        <div className="absolute start-3 top-3 z-10">
          <Dropdown
            open={isThumbnailsOpen}
            onOpenChange={setIsThumbnailsOpen}
            placement="bottom-start"
            matchReferenceWidth={false}
            renderOverlay={() => (
              <div className="flex w-36 flex-col">
                <div className="shrink-0 p-1">
                  <Input
                    size={ElementSize.Small}
                    aria-label={pageNumberLabel}
                    value={pageInputValue}
                    postfix={`/ ${totalPages}`}
                    inputMode="numeric"
                    onChange={(value) => setPageInputValue(value ?? '')}
                    onBlur={() => commitPageInput(pageInputValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPageInput(pageInputValue);
                    }}
                  />
                </div>
                <div
                  ref={panelRef}
                  id={thumbnailsRegionId}
                  role="region"
                  aria-label={thumbnailsLabel}
                  className="min-h-0 max-h-[70vh] overflow-y-auto overflow-x-hidden p-1 [scrollbar-gutter:stable]"
                >
                  {thumbnailItems}
                </div>
              </div>
            )}
          >
            <FabButton
              icon={
                isThumbnailsOpen ? (
                  <IconX size={DIAL_ICON_SIZE.LG} stroke={1.5} aria-hidden />
                ) : (
                  <IconMenu2
                    size={DIAL_ICON_SIZE.LG}
                    stroke={1.5}
                    aria-hidden
                  />
                )
              }
              aria-label={
                isThumbnailsOpen ? hideThumbnailsLabel : showThumbnailsLabel
              }
              aria-expanded={isThumbnailsOpen}
              aria-controls={isThumbnailsOpen ? thumbnailsRegionId : undefined}
            />
          </Dropdown>
        </div>
      )}
      <div
        className={mergeClasses(
          'min-w-0 flex-1 overflow-hidden',
          styles.viewer,
        )}
      >
        <DocumentPreview
          fileUrl={url}
          loadFileCb={loadPdf ?? fetchBlobFromUrl}
          highlights={highlights}
          selectedHighlightId={selectedHighlightId}
          showOccurrences={false}
          onTotalPagesChange={setTotalPages}
          thumbnailPageNumbers={requestedThumbnailPages}
          onThumbnailsLoaded={handleThumbnailsLoaded}
          onViewerReady={handleViewerReady}
          viewerOptions={{ enableVirtualScrolling: true }}
          containerClassName={
            hideHeader ? '[&>div:first-child]:hidden' : undefined
          }
        />
      </div>
    </div>
  );
};
