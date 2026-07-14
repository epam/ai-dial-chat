import { IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Image from 'next/image';

import classNames from 'classnames';

import { useResizeObserver } from '@/src/hooks/useResizeObserver';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getPdfUrlPage, stripUrlHash } from '@/src/utils/app/attachments';

import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Spinner } from '@/src/components/Common/Spinner';

import {
  DialGhostIconButton,
  DialSelect,
  ElementSize,
  SelectSize,
} from '@epam/ai-dial-ui-kit';
import {
  InputHighlightData,
  PDFHighlightViewer as PdfViewer,
  ZoomMode,
} from '@epam/pdf-highlighter-kit';
import type {
  PageChangeEvent,
  ZoomChangeEvent,
  ZoomValue,
} from '@epam/pdf-highlighter-kit';
import range from 'lodash-es/range';
import { GlobalWorkerOptions } from 'pdfjs-dist';

// Overwrite the CDN URL that @epam/pdf-highlighter-kit sets at module-load time.
// This runs after all imports are evaluated but before any component renders.
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface Props {
  url: string;
  highlights?: InputHighlightData[];
}

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

class PdfFetchError extends Error {
  constructor(public readonly status: number) {
    super(`Failed to fetch PDF (status ${status})`);
    this.name = 'PdfFetchError';
  }
}

const fetchPdfArrayBuffer = async (fileUrl: string): Promise<ArrayBuffer> => {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new PdfFetchError(response.status);
  }
  return response.arrayBuffer();
};

const getPdfLoadErrorMessage = (
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (error instanceof PdfFetchError) {
    if (error.status === 403) {
      return t(ChatI18nKeys.FileAccessRevoked);
    }
    if (error.status === 404) {
      return t(ChatI18nKeys.FileNotFound);
    }
  }

  const message = error instanceof Error ? error.message : 'Failed to load PDF';
  return t(ChatI18nKeys.FailedToLoadPdf, { error: message });
};

export const PdfHighlightViewer = ({ url, highlights }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const screenState = useScreenState();
  const isSmallScreen = screenState === ScreenState.SM;

  const fileUrl = useMemo(() => stripUrlHash(url), [url]);
  const initialPage = useMemo(() => getPdfUrlPage(url), [url]);

  const containerRef = useRef<HTMLDivElement>(null);

  const viewerRef = useRef<PdfViewer | null>(null);
  const pageRefsMap = useRef<Map<number, HTMLButtonElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const requestedThumbnailsRef = useRef<Set<number>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoomSelectValue, setZoomSelectValue] = useState<ZoomValue>(
    ZoomMode.AUTO,
  );
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());

  // Latest zoom mode for the resize handler (stable callback, no re-subscribe).
  const zoomModeRef = useRef<ZoomValue>(ZoomMode.AUTO);
  useEffect(() => {
    zoomModeRef.current = zoomSelectValue;
  }, [zoomSelectValue]);

  const zoomOptions = useMemo(
    () => [
      { label: t(ChatI18nKeys.Auto), value: ZoomMode.AUTO },
      { label: t(ChatI18nKeys.PageFit), value: ZoomMode.PAGE_FIT },
      ...ZOOM_PRESETS.map((v) => ({ label: `${v * 100}%`, value: String(v) })),
    ],
    [t],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    let cancelled = false;
    const viewer = new PdfViewer();
    const requestedThumbnails = requestedThumbnailsRef.current;

    const onPageChanged = (e: unknown) => {
      setCurrentPage((e as PageChangeEvent).currentPage);
    };

    const onZoomChanged = (e: unknown) => {
      const { scale } = e as ZoomChangeEvent;
      setZoomSelectValue((prev) => (typeof prev === 'string' ? prev : scale));
    };

    (async () => {
      try {
        await viewer.init(container, {
          enableTextSelection: true,
          enableVirtualScrolling: true,
          bufferPages: 2,
          maxCachedPages: 10,
          bboxOrigin: 'top-left',
        });

        if (cancelled) return;
        const pdfData = await fetchPdfArrayBuffer(fileUrl);
        if (cancelled) return;
        await viewer.loadPDF(pdfData);
        if (cancelled) return;

        if (highlights?.length) {
          viewer.loadHighlights(highlights);
        }
        viewerRef.current = viewer;
        setIsLoading(false);

        const total = viewer.getTotalPages();
        setTotalPages(total);

        viewer.addEventListener('pageChanged', onPageChanged);
        viewer.addEventListener('zoomChanged', onZoomChanged);

        const startPage =
          initialPage && initialPage > 1 && initialPage <= total
            ? initialPage
            : viewer.getCurrentPage();

        if (startPage > 1) {
          (viewer as unknown as { currentPage: number }).currentPage =
            startPage;
        }
        setCurrentPage(startPage);
      } catch (e) {
        if (cancelled) return;

        setError(getPdfLoadErrorMessage(e, t));
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      viewer.removeEventListener('pageChanged', onPageChanged);
      viewer.removeEventListener('zoomChanged', onZoomChanged);

      try {
        viewer.destroy();
      } catch {
        // Viewer may already be destroyed if the component unmounted during init.
      }

      if (viewerRef.current === viewer) {
        viewerRef.current = null;
      }

      setThumbnails(new Map());
      requestedThumbnails.clear();
    };
  }, [fileUrl, initialPage, t, highlights]);

  useEffect(() => {
    if (totalPages === 0) return;

    const THUMBNAIL_OPTIONS = {
      maxWidth: 150,
      format: 'image/webp' as const,
      quality: 0.7,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const pages = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.page))
          .filter((n) => !isNaN(n) && !requestedThumbnailsRef.current.has(n));

        if (!pages.length || !viewerRef.current) return;

        pages.forEach((n) => requestedThumbnailsRef.current.add(n));
        viewerRef.current
          .getThumbnailsDataUrl(pages, THUMBNAIL_OPTIONS)
          .then((map) => setThumbnails((prev) => new Map([...prev, ...map])))
          .catch((e) => {
            console.error('Error fetching thumbnails:', e);
          });
      },
      { threshold: 0 },
    );

    pageRefsMap.current.forEach((btn) => observer.observe(btn));
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [totalPages, fileUrl]);

  useEffect(() => {
    pageRefsMap.current
      .get(currentPage)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentPage]);

  const handleZoomSelect = useCallback((value: string) => {
    if (!viewerRef.current) return;

    const parsed = parseFloat(value);
    const zoomValue: ZoomValue = isNaN(parsed) ? (value as ZoomMode) : parsed;
    setZoomSelectValue(zoomValue);
    viewerRef.current.setZoom(zoomValue);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!viewerRef.current) return;

    const current = viewerRef.current.getZoom();
    const next = ZOOM_PRESETS.find((v) => v > current);

    if (!next) return;

    setZoomSelectValue(next);
    viewerRef.current.setZoom(next);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!viewerRef.current) return;

    const current = viewerRef.current.getZoom();
    const prev = [...ZOOM_PRESETS].reverse().find((v) => v < current);

    if (!prev) return;

    setZoomSelectValue(prev);
    viewerRef.current.setZoom(prev);
  }, []);

  const handleContainerResize = useCallback(() => {
    const viewer = viewerRef.current;
    const container = containerRef.current;

    if (!viewer || !container) return;
    if (container.clientWidth <= 0 || container.clientHeight <= 0) return;

    const mode = zoomModeRef.current;
    if (typeof mode === 'string') {
      viewer.setZoom(mode);
    }
  }, []);
  useResizeObserver(containerRef.current, handleContainerResize);

  return (
    <div className="flex size-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-1" data-qa="viewer-pages">
          {!isSmallScreen && (
            <span className="text-center text-sm font-semibold text-secondary">
              {t(ChatI18nKeys.Pages)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DialSelect
            options={zoomOptions}
            value={String(zoomSelectValue)}
            onChange={(val) => handleZoomSelect(val as string)}
            size={SelectSize.Sm}
            elementId="zoom-select"
          />
          <DialGhostIconButton
            size={ElementSize.Standard}
            icon={
              <IconZoomOut stroke={1.5} size={DEFAULT_ICON_SIZES.STANDARD} />
            }
            className="p-2"
            onClick={handleZoomOut}
            aria-label={t(ChatI18nKeys.ZoomOut)}
          />
          <DialGhostIconButton
            size={ElementSize.Standard}
            icon={
              <IconZoomIn stroke={1.5} size={DEFAULT_ICON_SIZES.STANDARD} />
            }
            className="p-2"
            onClick={handleZoomIn}
            aria-label={t(ChatI18nKeys.ZoomIn)}
          />
        </div>
      </div>

      <div className="mt-4 flex min-h-0 grow">
        {!isSmallScreen && (
          <div
            className="flex flex-col gap-2 overflow-y-auto"
            data-qa="pages-sidebar"
          >
            {range(1, totalPages + 1).map((pageNumber) => {
              const thumbUrl = thumbnails.get(pageNumber);
              return (
                <button
                  type="button"
                  key={pageNumber}
                  data-page={pageNumber}
                  ref={(el) => {
                    if (el) {
                      pageRefsMap.current.set(pageNumber, el);
                      observerRef.current?.observe(el);
                    } else {
                      pageRefsMap.current.delete(pageNumber);
                    }
                  }}
                  onClick={() => viewerRef.current?.setPage(pageNumber)}
                  className={classNames(
                    'flex flex-col items-center gap-1 rounded p-2 hover:bg-accent-primary-alpha',
                    pageNumber === currentPage && 'border border-primary',
                  )}
                  aria-label={`${t(ChatI18nKeys.Page)} ${pageNumber}`}
                  aria-current={pageNumber === currentPage ? 'page' : undefined}
                >
                  <div className="relative aspect-[3/4] w-24">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        fill
                        className="rounded object-contain"
                        alt={`${t(ChatI18nKeys.Page)} ${pageNumber}`}
                        unoptimized
                      />
                    ) : (
                      <div className="size-full animate-pulse rounded bg-layer-3" />
                    )}
                  </div>
                  <span className="text-xs text-secondary" aria-hidden="true">
                    {pageNumber}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="relative min-w-0 grow">
          <div
            ref={containerRef}
            className="size-full overflow-auto !bg-transparent [&_.pdf-container]:w-max [&_.pdf-container]:min-w-full [&_.pdf-container]:!bg-transparent [&_.pdf-container]:!p-2"
            data-qa="pdf-viewer-container"
          />
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-layer-3">
              <Spinner size={30} />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfHighlightViewer;
