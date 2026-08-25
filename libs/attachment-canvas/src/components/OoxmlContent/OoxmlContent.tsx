import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Spinner } from '@epam/ai-dial-ui-kit';
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
  /** OOXML source and format to render. */
  content: OoxmlCanvasContent;
  /** File name used as the viewer's accessible name. */
  fileName?: string;
  /** Message shown when the OOXML parser or renderer fails. */
  loadErrorLabel: string;
}

const createViewer = async (
  container: HTMLDivElement,
  format: OoxmlFileType,
  onError: () => void,
): Promise<OoxmlViewer> => {
  switch (format) {
    case OoxmlFileType.Docx: {
      const { DocxScrollViewer } = await import('@silurus/ooxml/docx');
      return new DocxScrollViewer(container, {
        enableTextSelection: true,
        refitOnResize: true,
        onError,
      });
    }
    case OoxmlFileType.Xlsx: {
      const { XlsxViewer } = await import('@silurus/ooxml/xlsx');
      return new XlsxViewer(container, { showZoomSlider: true, onError });
    }
    case OoxmlFileType.Pptx: {
      const { PptxScrollViewer } = await import('@silurus/ooxml/pptx');
      return new PptxScrollViewer(container, {
        enableTextSelection: true,
        refitOnResize: true,
        onError,
      });
    }
  }
};

/** Renders DOCX, XLSX, and PPTX attachments with `@silurus/ooxml`. */
export const OoxmlContent: FC<OoxmlContentProps> = ({
  content,
  fileName,
  loadErrorLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) return;

    let viewer: OoxmlViewer | undefined;
    let disposed = false;
    setIsLoading(true);
    setHasError(false);

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
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        role="document"
        aria-label={fileName}
        aria-busy={isLoading}
        className={mergeClasses('h-full w-full overflow-hidden', styles.viewer)}
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
                stroke={1.5}
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
