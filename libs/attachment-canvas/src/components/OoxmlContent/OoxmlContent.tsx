import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE, Spinner } from '@epam/ai-dial-ui-kit';
import type { XlsxSelectionContext } from '@silurus/ooxml/xlsx';
import { IconAlertTriangle } from '@tabler/icons-react';
import { type FC, useEffect, useRef, useState } from 'react';
import type { OoxmlCanvasContent } from '../../models/attachment-canvas';
import { OoxmlFileType } from '../../types/attachment-canvas';
import type {
  OoxmlHighlightSurface,
  TaggedHighlightRect,
} from '../../utils/ooxml-highlight-surfaces';
import styles from './OoxmlContent.module.scss';

interface OoxmlViewer {
  load(source: string | ArrayBuffer): Promise<void>;
  destroy(): void;
}

/** A loaded viewer plus everything the renderer has to release for it. */
interface OoxmlSurface {
  /** The viewer painting the document. */
  viewer: { destroy(): void };
  /**
   * Engine borrowed through a `from*()` factory. `viewer.destroy()` deliberately
   * leaves it alive, so the renderer owns this second `destroy()`.
   */
  engine?: { destroy(): void };
  /** Highlight resolution against the displayed parse. Absent when no highlights were requested. */
  highlights?: OoxmlHighlightSurface;
}

/** Callbacks a viewer is constructed with, all of them guarded against disposal by the caller. */
interface OoxmlSurfaceCallbacks {
  /** Reports a parse or render failure. */
  onError: () => void;
  /** Reports the active XLSX cell so the formula panel can show it. */
  onXlsxSelectionContextChange: (context: XlsxSelectionContext | null) => void;
  /** Reports that the document-to-pixel mapping changed and rectangles are stale. */
  onGeometryInvalidated: () => void;
}

const getActiveCellContent = (context: XlsxSelectionContext | null): string => {
  if (context?.kind !== 'range') return '';

  const { activeCell } = context.selection;
  const cell = context.cells.find(
    ({ address }) =>
      address.row === activeCell.row && address.col === activeCell.col,
  );
  if (cell == null) return '';

  const formula = cell.formula;
  if (formula == null || formula.trim().length === 0) {
    return cell.displayText;
  }

  return formula.startsWith('=') ? formula : `=${formula}`;
};

const createViewer = async (
  container: HTMLDivElement,
  format: OoxmlFileType,
  { onError, onXlsxSelectionContextChange }: OoxmlSurfaceCallbacks,
): Promise<OoxmlViewer> => {
  switch (format) {
    case OoxmlFileType.Docx: {
      const [{ DocxScrollViewer }, { chartEx }] = await Promise.all([
        import('@silurus/ooxml/docx'),
        import('@silurus/ooxml/chart-ex'),
      ]);
      return new DocxScrollViewer(container, {
        enableTextSelection: true,
        refitOnResize: true,
        chartEx,
        onError,
      });
    }
    case OoxmlFileType.Xlsx: {
      const [{ XlsxViewer }, { chartEx }] = await Promise.all([
        import('@silurus/ooxml/xlsx'),
        import('@silurus/ooxml/chart-ex'),
      ]);
      return new XlsxViewer(container, {
        showZoomSlider: true,
        chartEx,
        onError,
        onSelectionContextChange: onXlsxSelectionContextChange,
      });
    }
    case OoxmlFileType.Csv: {
      const { XlsxSheetViewer } = await import('@silurus/ooxml/xlsx');
      const canvas = document.createElement('canvas');
      canvas.className = styles.spreadsheetCanvas;
      container.replaceChildren(canvas);
      const viewer = new XlsxSheetViewer(canvas, {
        showScrollbars: true,
        onError,
      });
      return {
        load: (source) => viewer.load(source, { format: 'csv' }),
        destroy: () => viewer.destroy(),
      };
    }
    case OoxmlFileType.Pptx: {
      const [{ PptxScrollViewer }, { chartEx }] = await Promise.all([
        import('@silurus/ooxml/pptx'),
        import('@silurus/ooxml/chart-ex'),
      ]);
      return new PptxScrollViewer(container, {
        enableTextSelection: true,
        refitOnResize: true,
        chartEx,
        onError,
      });
    }
  }
};

/*
 * Highlighted DOCX and PPTX previews load the engine first and create the viewer
 * from it, so the rectangles are computed from the same parsed bytes the viewer
 * paints. A second parse could disagree about pagination, and a rectangle drawn
 * over the wrong pagination is silently wrong — worse than no rectangle.
 *
 * XLSX stays on the self-loading path in every case: its cell geometry lives on
 * the viewer, so borrowing an engine would add a teardown obligation for nothing.
 */
const createHighlightedSurface = async (
  container: HTMLDivElement,
  content: OoxmlCanvasContent,
  callbacks: OoxmlSurfaceCallbacks,
  isDisposed: () => boolean,
): Promise<OoxmlSurface> => {
  const { onError, onXlsxSelectionContextChange, onGeometryInvalidated } =
    callbacks;

  switch (content.format) {
    case OoxmlFileType.Docx: {
      const [
        { DocxDocument, DocxScrollViewer },
        { chartEx },
        { createDocxHighlightSurface },
      ] = await Promise.all([
        import('@silurus/ooxml/docx'),
        import('@silurus/ooxml/chart-ex'),
        import('../../utils/ooxml-highlight-surfaces'),
      ]);
      const document = await DocxDocument.load(content.url, { chartEx });
      if (isDisposed()) {
        document.destroy();
        throw new DisposedError();
      }
      const viewer = DocxScrollViewer.fromDocument(container, document, {
        enableTextSelection: true,
        refitOnResize: true,
        onError,
        onScaleChange: onGeometryInvalidated,
        onVisiblePageChange: onGeometryInvalidated,
      });
      return {
        viewer,
        engine: document,
        highlights: createDocxHighlightSurface(
          container,
          document,
          viewer,
          isDisposed,
        ),
      };
    }
    case OoxmlFileType.Pptx: {
      const [
        { PptxPresentation, PptxScrollViewer },
        { chartEx },
        { createPptxHighlightSurface },
      ] = await Promise.all([
        import('@silurus/ooxml/pptx'),
        import('@silurus/ooxml/chart-ex'),
        import('../../utils/ooxml-highlight-surfaces'),
      ]);
      const presentation = await PptxPresentation.load(content.url, {
        chartEx,
      });
      if (isDisposed()) {
        presentation.destroy();
        throw new DisposedError();
      }
      const viewer = PptxScrollViewer.fromPresentation(
        container,
        presentation,
        {
          enableTextSelection: true,
          refitOnResize: true,
          onError,
          onScaleChange: onGeometryInvalidated,
          onVisibleSlideChange: onGeometryInvalidated,
        },
      );
      return {
        viewer,
        engine: presentation,
        highlights: createPptxHighlightSurface(
          container,
          presentation,
          viewer,
          isDisposed,
        ),
      };
    }
    case OoxmlFileType.Xlsx: {
      const [{ XlsxViewer }, { chartEx }, { createXlsxHighlightSurface }] =
        await Promise.all([
          import('@silurus/ooxml/xlsx'),
          import('@silurus/ooxml/chart-ex'),
          import('../../utils/ooxml-highlight-surfaces'),
        ]);
      const viewer = new XlsxViewer(container, {
        showZoomSlider: true,
        chartEx,
        onError,
        onSelectionContextChange: onXlsxSelectionContextChange,
        onViewportChange: onGeometryInvalidated,
        onScaleChange: onGeometryInvalidated,
        onSheetChange: onGeometryInvalidated,
      });
      await viewer.load(content.url);
      return {
        viewer,
        highlights: createXlsxHighlightSurface(container, viewer, isDisposed),
      };
    }
    /* CSV carries no OOXML layout model, so it is never highlighted. */
    case OoxmlFileType.Csv: {
      const viewer = await createViewer(container, content.format, callbacks);
      await viewer.load(content.url);
      return { viewer };
    }
  }
};

/** Thrown to abandon acquisition that finished after the effect was torn down. */
class DisposedError extends Error {}

interface OoxmlContentProps {
  /** OOXML or CSV source and format to render. */
  content: OoxmlCanvasContent;
  /** File name used as the viewer's accessible name. */
  fileName?: string;
  /** Message shown when the document parser or renderer fails. */
  loadErrorLabel: string;
  /** Accessible label for the panel that shows the active XLSX cell content. */
  formulaLabel: string;
  /** CSS class applied to the decorative `fx` label. */
  formulaLabelClassName: string;
  /** Accessible label for the cited-locations overlay region. Defaults to `'Cited locations'`. */
  highlightsLabel?: string;
  /** Status announced once the cited location has been brought into view. Defaults to `'Scrolled to the cited location'`. */
  highlightNavigatedLabel?: string;
}

/** Renders DOCX, XLSX, PPTX, and CSV attachments with `@silurus/ooxml`, optionally highlighting cited locations. */
export const OoxmlContent: FC<OoxmlContentProps> = ({
  content,
  fileName,
  loadErrorLabel,
  formulaLabel,
  formulaLabelClassName,
  highlightsLabel = 'Cited locations',
  highlightNavigatedLabel = 'Scrolled to the cited location',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeCellContent, setActiveCellContent] = useState('');
  const [rects, setRects] = useState<TaggedHighlightRect[]>([]);
  const [hasNavigated, setHasNavigated] = useState(false);

  const { highlights, selectedHighlightId } = content;
  const hasHighlights = highlights != null && highlights.length > 0;
  const surfaceRef = useRef<OoxmlHighlightSurface>(undefined);
  /* Read by `recompute` so a new `highlights` array (a fresh reference on every
   * citation click, per `annotationToOoxmlCanvasContent`) re-measures rectangles
   * against the still-open surface below, instead of the main effect reloading
   * the whole document because `highlights` sits in that effect's deps. */
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const scheduleRecomputeRef = useRef<() => void>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) return;

    let surface: OoxmlSurface | undefined;
    let disposed = false;
    let pendingFrame: number | undefined;
    const isDisposed = (): boolean => disposed;

    setIsLoading(true);
    setHasError(false);
    setActiveCellContent('');
    setRects([]);
    setHasNavigated(false);

    /* A wheel-zoom or drag-scroll burst fires many invalidations per frame; all
     * of them collapse into one recompute. */
    const scheduleRecompute = (): void => {
      if (disposed || pendingFrame != null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = undefined;
        void recompute();
      });
    };

    const recompute = async (): Promise<void> => {
      const highlightSurface = surface?.highlights;
      const currentHighlights = highlightsRef.current;
      if (disposed || highlightSurface == null || currentHighlights == null)
        return;
      try {
        const next = await highlightSurface.measure(currentHighlights);
        if (!disposed) setRects(next);
      } catch {
        /* A location that cannot be resolved is not a render failure: the
         * document opens fine, it simply carries no highlight. */
        if (!disposed) setRects([]);
      }
    };

    const callbacks: OoxmlSurfaceCallbacks = {
      onError: () => {
        if (!disposed) {
          setIsLoading(false);
          setHasError(true);
        }
      },
      onXlsxSelectionContextChange: (selectionContext) => {
        if (!disposed) {
          setActiveCellContent(getActiveCellContent(selectionContext));
        }
      },
      onGeometryInvalidated: scheduleRecompute,
    };

    const loadDocument = async (): Promise<void> => {
      try {
        if (hasHighlights) {
          const next = await createHighlightedSurface(
            container,
            content,
            callbacks,
            isDisposed,
          );
          if (disposed) {
            next.viewer.destroy();
            next.engine?.destroy();
            return;
          }
          surface = next;
          surfaceRef.current = next.highlights;
        } else {
          const viewer = await createViewer(
            container,
            content.format,
            callbacks,
          );
          if (disposed) {
            viewer.destroy();
            return;
          }
          surface = { viewer };
          surfaceRef.current = undefined;
          await viewer.load(content.url);
        }
        if (disposed) return;
        setIsLoading(false);
        await recompute();
      } catch (error) {
        if (error instanceof DisposedError || disposed) return;
        surface?.viewer.destroy();
        surface?.engine?.destroy();
        surface = undefined;
        surfaceRef.current = undefined;
        container.replaceChildren();
        setIsLoading(false);
        setHasError(true);
      }
    };

    /* Scroll events do not bubble, but they do reach a capturing listener on an
     * ancestor, which avoids reaching into the viewer for its private host. */
    container.addEventListener('scroll', scheduleRecompute, true);
    scheduleRecomputeRef.current = scheduleRecompute;
    void loadDocument();

    return () => {
      disposed = true;
      container.removeEventListener('scroll', scheduleRecompute, true);
      if (pendingFrame != null) cancelAnimationFrame(pendingFrame);
      scheduleRecomputeRef.current = undefined;
      /* Order matters: a viewer built by `fromDocument`/`fromPresentation`
       * leaves its borrowed engine alive, so the engine is released after it. */
      surface?.viewer.destroy();
      surface?.engine?.destroy();
      surfaceRef.current = undefined;
      container.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.format, content.url, hasHighlights]);

  /* Re-measures rectangles against the already-open surface whenever the
   * caller passes a new `highlights` array for the same document, instead of
   * the effect above reloading the whole viewer — see the `highlightsRef` note. */
  useEffect(() => {
    scheduleRecomputeRef.current?.();
  }, [highlights]);

  useEffect(() => {
    const highlightSurface = surfaceRef.current;
    if (highlightSurface == null || isLoading) return;

    const selected = highlights?.find(({ id }) => id === selectedHighlightId);
    const location = selected?.locations.at(0);
    if (location == null) return;

    let disposed = false;
    const navigate = async (): Promise<void> => {
      try {
        await highlightSurface.navigate(location);
      } catch {
        /* Navigation is best-effort; a failure leaves the document on page one
         * rather than reporting an error the file did not cause. */
        return;
      }
      if (disposed) return;
      setHasNavigated(true);
    };
    void navigate();

    return () => {
      disposed = true;
    };
  }, [highlights, selectedHighlightId, isLoading]);

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden">
      {content.format === OoxmlFileType.Xlsx && (
        <div
          role="region"
          aria-label={formulaLabel}
          className={mergeClasses(
            'flex min-w-0 shrink-0 items-center gap-2 border-b px-3 py-2',
            styles.formulaPanel,
          )}
        >
          <span
            aria-hidden="true"
            className={mergeClasses('shrink-0', formulaLabelClassName)}
          >
            fx
          </span>
          <code
            dir="ltr"
            tabIndex={0}
            aria-live="polite"
            className={mergeClasses(
              'h-8 min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded border px-2 py-1 text-sm focus-visible:outline focus-visible:outline-focus',
              styles.formulaValue,
            )}
          >
            {activeCellContent}
          </code>
        </div>
      )}
      <div className="relative min-h-0 w-full flex-1">
        <div
          ref={containerRef}
          role="document"
          aria-label={fileName}
          aria-busy={isLoading}
          className={mergeClasses(
            'h-full w-full overflow-hidden',
            styles.viewer,
          )}
        />
        {rects.length > 0 && (
          <div
            role="region"
            aria-label={highlightsLabel}
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            {rects.map((rect, index) => (
              <div
                key={`${rect.highlightId}-${index}`}
                aria-hidden="true"
                /*
                 * Canvas geometry, not directional layout: `left`/`top` address a
                 * position inside a page whose own layout the vendor already
                 * resolved, RTL included. Mirroring these under `dir="rtl"` would
                 * move every highlight off its text in Arabic. Do not convert
                 * them to logical properties.
                 */
                style={{
                  left: `${rect.left}px`,
                  top: `${rect.top}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                }}
                data-selected={rect.highlightId === selectedHighlightId}
                data-clipped={rect.isClippedAtEnd === true}
                className={mergeClasses('absolute', styles.highlight)}
              />
            ))}
          </div>
        )}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {hasNavigated ? highlightNavigatedLabel : ''}
      </div>
      {(isLoading || hasError) && (
        <div
          role={hasError ? 'alert' : undefined}
          aria-live="polite"
          className={mergeClasses(
            'absolute inset-0 flex items-center justify-center',
            styles.statusOverlay,
          )}
        >
          {isLoading ? (
            <Spinner size={48} />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <IconAlertTriangle
                aria-hidden="true"
                size={60}
                stroke={DIAL_KIT_ICON_STROKE}
                className={styles.errorIcon}
              />
              <p className="text-center">{loadErrorLabel}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
