import type { PdfViewerApi } from '@epam/ai-dial-react-pdf-highlighter';
import {
  DocumentPreview,
  PageThumbnail,
} from '@epam/ai-dial-react-pdf-highlighter';
import type { InputHighlightData } from '@epam/pdf-highlighter-kit';
import { type FC, useCallback, useMemo, useRef, useState } from 'react';
import { fetchBlobFromUrl } from '../../utils/download';

export interface PdfContentProps {
  url: string;
  highlights: InputHighlightData[];
  selectedHighlightId?: string;
  loadPdf?: (url: string) => Promise<Blob>;
  fileName?: string;
}

export const PdfContent: FC<PdfContentProps> = ({
  url,
  highlights,
  selectedHighlightId,
  loadPdf,
}) => {
  const [totalPages, setTotalPages] = useState(0);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [selectedPage, setSelectedPage] = useState(1);
  const viewerApiRef = useRef<PdfViewerApi | null>(null);

  const thumbnailPageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages],
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

  return (
    <div className="flex h-full overflow-hidden">
      {totalPages > 0 && (
        <div className="w-30 mr-1 shrink-0 overflow-auto pr-0.5">
          {thumbnailPageNumbers.map((pageNum) => (
            <PageThumbnail
              key={pageNum}
              pageNum={pageNum}
              onSelectPage={handleSelectPage}
              isSelected={selectedPage === pageNum}
              isLoading={!thumbnails.has(pageNum)}
              thumbnailUrl={thumbnails.get(pageNum) ?? null}
            />
          ))}
        </div>
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        <DocumentPreview
          fileUrl={url}
          loadFileCb={loadPdf ?? fetchBlobFromUrl}
          highlights={highlights}
          selectedHighlightId={selectedHighlightId}
          showOccurrences={false}
          onTotalPagesChange={setTotalPages}
          thumbnailPageNumbers={thumbnailPageNumbers}
          onThumbnailsLoaded={handleThumbnailsLoaded}
          onViewerReady={handleViewerReady}
        />
      </div>
    </div>
  );
};
