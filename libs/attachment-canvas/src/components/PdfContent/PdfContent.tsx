import { useIsMobile } from '@epam/ai-dial-chat-shared';
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

export interface PdfContentProps {
  url: string;
  /**
   * The file bytes, when already available (e.g. fetched while resolving
   * `url`). When present, it is used directly instead of re-fetching `url`
   * via `loadPdf`/`fetchBlobFromUrl`.
   */
  blob?: Blob;
  highlights: InputHighlightData[];
  selectedHighlightId?: string;
  loadPdf?: (url: string) => Promise<Blob>;
  fileName?: string;
}

export const PdfContent: FC<PdfContentProps> = ({
  url,
  blob,
  highlights,
  selectedHighlightId,
  loadPdf,
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

  useEffect(() => {
    if (!selectedHighlightId) return;
    const match = highlights.find((h) => h.id === selectedHighlightId);
    const page = match?.bboxes[0]?.page;
    if (page != null) setSelectedPage(page);
  }, [selectedHighlightId, highlights]);

  useEffect(() => {
    thumbnailNodeRefs.current.get(selectedPage)?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }, [selectedPage, totalPages]);

  const thumbnailPageNumbers = useMemo(
    () => (isMobile ? [] : Array.from({ length: totalPages }, (_, i) => i + 1)),
    [isMobile, totalPages],
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

  const loadFileCb = useCallback(
    (fileUrl: string) =>
      blob != null
        ? Promise.resolve(blob)
        : (loadPdf ?? fetchBlobFromUrl)(fileUrl),
    [blob, loadPdf],
  );

  return (
    <div className="flex h-full overflow-hidden">
      {totalPages > 0 && (
        <div className="w-30 me-1 shrink-0 overflow-auto pe-0.5 mobile:hidden">
          {thumbnailPageNumbers.map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => {
                if (el) thumbnailNodeRefs.current.set(pageNum, el);
                else thumbnailNodeRefs.current.delete(pageNum);
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
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        <DocumentPreview
          fileUrl={url}
          loadFileCb={loadFileCb}
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
