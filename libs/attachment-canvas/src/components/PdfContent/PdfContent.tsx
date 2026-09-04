import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { PdfViewerApi } from '@epam/ai-dial-react-pdf-highlighter';
import {
  DocumentPreview,
  PageThumbnail,
} from '@epam/ai-dial-react-pdf-highlighter';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  ElementSize,
  FabButton,
  Input,
} from '@epam/ai-dial-ui-kit';
import type { InputHighlightData } from '@epam/pdf-highlighter-kit';
import { IconMenu2, IconX } from '@tabler/icons-react';
import {
  type FC,
  type ReactElement,
  type UIEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { fetchBlobFromUrl } from '../../utils/download';
import styles from './PdfContent.module.scss';
/*
 * These stylesheets are only needed once a PDF is actually being rendered.
 * `PdfContent` is itself only ever reached through a `lazy()` dynamic import
 * (see AttachmentCanvasBody), so importing them here — rather than eagerly
 * from the host app's entry point — keeps this ~20 KB of vendor CSS out of
 * the initial page load.
 */
import '@epam/ai-dial-react-pdf-highlighter/styles.css';
import '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css';

/*
 * `pdfjs-dist`'s `GlobalWorkerOptions.workerSrc` is a global, shared by every
 * consumer of the package in the host app — this library must not decide it
 * unilaterally (library-isolation: a host-owned third-party runtime setting,
 * and a different `pdfjs-dist` version/consumer elsewhere in the app could
 * disagree with a value hardcoded here). The host supplies `configurePdfWorker`
 * instead; it's called once, the first time a PDF is actually opened, since
 * this module is only ever reached through the dynamic import above. Guarded
 * by a module-scope flag (not React state) so React's render/effect timing
 * can't delay it past the point `DocumentPreview` below starts loading the
 * document — it must run before that, not merely before paint.
 */
let hasConfiguredPdfWorker = false;

/** Number of pages eagerly requested as soon as the document loads, before the user opens the panel. */
const THUMBNAIL_EAGER_BATCH_SIZE = 15;
/** Extra rows rendered above/below the visible window so scrolling doesn't outrun loaded thumbnails. */
const THUMBNAIL_OVERSCAN = 3;
/** Assumed thumbnail row height (px) until the first rendered row is measured. */
const THUMBNAIL_ITEM_HEIGHT_FALLBACK = 172;
/** Assumed scrollable panel height (px) until it is measured via `ResizeObserver`. */
const THUMBNAIL_PANEL_HEIGHT_FALLBACK = 400;
/** Debounce (ms) before requesting thumbnails for a newly scrolled-to range, so rapid scrolling doesn't restart the vendor's internal batch fetch on every frame. */
const THUMBNAIL_SCROLL_REQUEST_DEBOUNCE_MS = 150;
/**
 * Number of animation frames to keep re-centering horizontal scroll after a
 * detected zoom change. The vendor viewer re-renders pages asynchronously
 * (`reRenderVisiblePages` awaits per-page dimensions one at a time) and
 * exposes no `onZoomChange` callback, so the new page width isn't known the
 * instant `getZoom()` changes — polling for a short window catches it once
 * layout settles.
 */
const ZOOM_RECENTER_CORRECTION_FRAMES = 60;

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
   * Configures `pdfjs-dist`'s worker (`GlobalWorkerOptions.workerSrc`) for the
   * host app. Called once, the first time a PDF attachment is opened. When
   * omitted, `@epam/pdf-highlighter-kit`'s own CDN-hosted worker fallback is
   * used instead, so PDF rendering still works, just without the host's own
   * bundled worker asset.
   */
  configurePdfWorker?: () => void | Promise<void>;
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
  configurePdfWorker,
  hideHeader = false,
  labels: {
    thumbnailsLabel = 'Thumbnails',
    showThumbnailsLabel = 'Show thumbnails',
    hideThumbnailsLabel = 'Hide thumbnails',
    pageNumberLabel = 'Page number',
  } = {},
}) => {
  /*
   * Run before any child (including `DocumentPreview` below) is created, so
   * the worker is configured before the document fetch/parse it triggers —
   * not inside a `useEffect`, which would fire after `DocumentPreview`'s own
   * mount effect (child effects run before the parent's).
   */
  if (!hasConfiguredPdfWorker && configurePdfWorker) {
    hasConfiguredPdfWorker = true;
    void configurePdfWorker();
  }

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
  const panelRef = useRef<HTMLDivElement>(null);
  const [requestedThumbnailPages, setRequestedThumbnailPages] = useState<
    number[]
  >([]);

  const [itemHeight, setItemHeight] = useState(THUMBNAIL_ITEM_HEIGHT_FALLBACK);
  const [panelHeight, setPanelHeight] = useState(
    THUMBNAIL_PANEL_HEIGHT_FALLBACK,
  );
  const [scrollTop, setScrollTop] = useState(0);
  const hasMeasuredItemHeightRef = useRef(false);
  const latestScrollTopRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedHighlightId) return;
    const match = highlights.find((h) => h.id === selectedHighlightId);
    const page = match?.bboxes[0]?.page;
    if (page != null) setSelectedPage(page);
  }, [selectedHighlightId, highlights]);

  /* Keep the scrollable panel's height in sync with its actual rendered size (it's capped by `max-h-[70vh]`, so viewport size matters). */
  useEffect(() => {
    const panel = panelRef.current;
    if (!isThumbnailsOpen || !panel) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setPanelHeight(height);
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [isThumbnailsOpen]);

  const measureItemHeight = useCallback((el: HTMLDivElement | null) => {
    if (!el || hasMeasuredItemHeightRef.current) return;
    const height = el.getBoundingClientRect().height;
    if (height > 0) {
      hasMeasuredItemHeightRef.current = true;
      setItemHeight(height);
    }
  }, []);

  const handlePanelScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    latestScrollTopRef.current = e.currentTarget.scrollTop;
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
  }, []);

  useEffect(
    () => () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    },
    [],
  );

  /*
   * Scroll to the selected page by setting `scrollTop` on the panel
   * directly, computed purely from page index * item height rather than
   * looking up the thumbnail's DOM node — with virtualization the target
   * page may not be mounted yet. (`Element.scrollIntoView()` is also
   * unusable here: the panel is rendered through the `Dropdown`'s portal
   * with floating-ui's `position: fixed` placement, which isn't anchored to
   * any ancestor's scroll offset, so `scrollIntoView`'s ancestor walk falls
   * through to scrolling the real `<html>` root instead.)
   */
  useEffect(() => {
    const container = panelRef.current;
    if (!container || totalPages === 0) return;
    const targetTop =
      (selectedPage - 1) * itemHeight -
      container.clientHeight / 2 +
      itemHeight / 2;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
  }, [selectedPage, totalPages, isThumbnailsOpen, itemHeight]);

  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / itemHeight) - THUMBNAIL_OVERSCAN,
  );
  const visibleRowCount =
    Math.ceil(panelHeight / itemHeight) + THUMBNAIL_OVERSCAN * 2;
  const endIndex = Math.min(totalPages - 1, startIndex + visibleRowCount);

  /*
   * Eagerly request the first batch of thumbnails as soon as the document
   * finishes loading, even while the panel is still collapsed, so they're
   * ready by the time the user opens it.
   */
  useEffect(() => {
    if (totalPages === 0) return;
    const eagerEnd = Math.min(totalPages, THUMBNAIL_EAGER_BATCH_SIZE);
    setRequestedThumbnailPages(
      Array.from({ length: eagerEnd }, (_, i) => i + 1),
    );
  }, [totalPages]);

  /*
   * Extend the requested set on demand as the user scrolls the panel,
   * debounced so a fast scroll doesn't repeatedly restart the vendor's
   * internal batch fetch effect. Pages already requested are never removed
   * — the array only grows — since the vendor's `thumbnailPageNumbers`
   * effect aborts and restarts its whole batch loop on every reference
   * change.
   */
  useEffect(() => {
    if (!isThumbnailsOpen || totalPages === 0) return;
    const timeoutId = setTimeout(() => {
      setRequestedThumbnailPages((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (let pageNum = startIndex + 1; pageNum <= endIndex + 1; pageNum++) {
          if (!next.has(pageNum)) {
            next.add(pageNum);
            changed = true;
          }
        }
        return changed ? Array.from(next).sort((a, b) => a - b) : prev;
      });
    }, THUMBNAIL_SCROLL_REQUEST_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [isThumbnailsOpen, startIndex, endIndex, totalPages]);

  const handleThumbnailsLoaded = useCallback((map: Map<number, string>) => {
    setThumbnails((prev) => new Map([...prev, ...map]));
  }, []);

  const [isViewerReady, setIsViewerReady] = useState(false);

  const handleViewerReady = useCallback((api: PdfViewerApi) => {
    viewerApiRef.current = api;
    setIsViewerReady(true);
  }, []);

  const viewerContainerRef = useRef<HTMLDivElement>(null);

  /*
   * Auto zoom can render the page wider than the panel, which produces a
   * horizontal scrollbar on the vendor's `.pdf-highlight-viewer` element
   * (see PdfContent.module.scss). Center that overflow by width:
   * - `ResizeObserver` on `.pdf-container`/`.pdf-highlight-viewer` catches
   *   layout-driven changes (panel resize, page width changes once rendered).
   * - Polling `viewerApiRef.current.getZoom()` catches a zoom change itself —
   *   `PdfViewerApi` exposes no `onZoomChange` callback, so this is the only
   *   way to detect it — and keeps re-centering for a short window afterward
   *   since the vendor's re-render is asynchronous, so the new width isn't
   *   final the instant the zoom value changes.
   */
  useEffect(() => {
    if (!isViewerReady) return;
    const root = viewerContainerRef.current;
    const pdfContainer = root?.querySelector<HTMLElement>('.pdf-container');
    const scrollContainer = root?.querySelector<HTMLElement>(
      '.pdf-highlight-viewer',
    );
    if (!pdfContainer || !scrollContainer) return;

    const centerHorizontally = () => {
      const overflow =
        scrollContainer.scrollWidth - scrollContainer.clientWidth;
      if (overflow > 0) {
        scrollContainer.scrollLeft = overflow / 2;
      }
    };

    centerHorizontally();
    const observer = new ResizeObserver(centerHorizontally);
    observer.observe(pdfContainer);
    observer.observe(scrollContainer);

    let lastZoom = viewerApiRef.current?.getZoom();
    let correctionFramesLeft = 0;
    let rafId: number;
    const tick = () => {
      const zoom = viewerApiRef.current?.getZoom();
      if (zoom !== lastZoom) {
        lastZoom = zoom;
        correctionFramesLeft = ZOOM_RECENTER_CORRECTION_FRAMES;
      }
      if (correctionFramesLeft > 0) {
        centerHorizontally();
        correctionFramesLeft -= 1;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [isViewerReady]);

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

  const thumbnailItems: ReactElement[] = [];
  for (
    let pageNum = startIndex + 1;
    pageNum <= endIndex + 1 && pageNum <= totalPages;
    pageNum++
  ) {
    thumbnailItems.push(
      <div
        key={pageNum}
        ref={pageNum === startIndex + 1 ? measureItemHeight : undefined}
      >
        <PageThumbnail
          pageNum={pageNum}
          onSelectPage={handleSelectPage}
          isSelected={selectedPage === pageNum}
          isLoading={!thumbnails.has(pageNum)}
          thumbnailUrl={thumbnails.get(pageNum) ?? null}
        />
      </div>,
    );
  }

  const topSpacerHeight = startIndex * itemHeight;
  const bottomSpacerHeight =
    Math.max(0, totalPages - endIndex - 1) * itemHeight;

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
                  onScroll={handlePanelScroll}
                  className="max-h-[70vh] min-h-0 overflow-y-auto overflow-x-hidden p-1 [scrollbar-gutter:stable]"
                >
                  <div style={{ height: topSpacerHeight }} />
                  {thumbnailItems}
                  <div style={{ height: bottomSpacerHeight }} />
                </div>
              </div>
            )}
          >
            <FabButton
              icon={
                isThumbnailsOpen ? (
                  <IconX
                    size={DIAL_ICON_SIZE.LG}
                    stroke={DIAL_KIT_ICON_STROKE}
                    aria-hidden
                  />
                ) : (
                  <IconMenu2
                    size={DIAL_ICON_SIZE.LG}
                    stroke={DIAL_KIT_ICON_STROKE}
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
        ref={viewerContainerRef}
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
