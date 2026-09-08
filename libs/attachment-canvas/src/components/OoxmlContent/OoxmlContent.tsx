import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE, Spinner } from '@epam/ai-dial-ui-kit';
import type { XlsxSelectionContext } from '@silurus/ooxml/xlsx';
import { IconAlertTriangle } from '@tabler/icons-react';
import { type FC, useEffect, useRef, useState } from 'react';
import type { OoxmlCanvasContent } from '../../models/attachment-canvas';
import { OoxmlFileType } from '../../types/attachment-canvas';
import styles from './OoxmlContent.module.scss';

interface OoxmlViewer {
  load(source: string | ArrayBuffer): Promise<void>;
  destroy(): void;
}

interface OoxmlContentProps {
  /** OOXML or CSV source and format to render. */
  content: OoxmlCanvasContent;
  /** File name used as the viewer's accessible name. */
  fileName?: string;
  /** Message shown when the document parser or renderer fails. */
  loadErrorLabel: string;
  /** Accessible label for the panel that shows the active XLSX cell content. */
  formulaLabel: string;
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
  onError: () => void,
  onXlsxSelectionContextChange: (context: XlsxSelectionContext | null) => void,
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

/** Renders DOCX, XLSX, PPTX, and CSV attachments with `@silurus/ooxml`. */
export const OoxmlContent: FC<OoxmlContentProps> = ({
  content,
  fileName,
  loadErrorLabel,
  formulaLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeCellContent, setActiveCellContent] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) return;

    let viewer: OoxmlViewer | undefined;
    let disposed = false;
    setIsLoading(true);
    setHasError(false);
    setActiveCellContent('');

    const loadDocument = async (): Promise<void> => {
      try {
        const handleViewerError = (): void => {
          if (!disposed) {
            setIsLoading(false);
            setHasError(true);
          }
        };
        const nextViewer = await createViewer(
          container,
          content.format,
          handleViewerError,
          (selectionContext) => {
            if (!disposed) {
              setActiveCellContent(getActiveCellContent(selectionContext));
            }
          },
        );
        if (disposed) {
          nextViewer.destroy();
          return;
        }
        viewer = nextViewer;
        await viewer.load(content.url);
        if (!disposed) setIsLoading(false);
      } catch {
        if (!disposed) {
          viewer?.destroy();
          viewer = undefined;
          container.replaceChildren();
          setIsLoading(false);
          setHasError(true);
        }
      }
    };

    void loadDocument();

    return () => {
      disposed = true;
      viewer?.destroy();
      container.replaceChildren();
    };
  }, [content.format, content.url]);

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
            className="shrink-0 font-serif text-lg italic"
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
      <div
        ref={containerRef}
        role="document"
        aria-label={fileName}
        aria-busy={isLoading}
        className={mergeClasses(
          'min-h-0 w-full flex-1 overflow-hidden',
          styles.viewer,
        )}
      />
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
