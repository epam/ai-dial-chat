import dynamic from 'next/dynamic';

import { Spinner } from '@/src/components/Common/Spinner';

// pdfjs-dist relies on browser globals (window, Worker, DOMMatrix), so the
// real viewer is loaded only on the client and only when actually rendered.
export const PdfHighlightViewerLazy = dynamic(
  () => import('./PdfHighlightViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center">
        <Spinner size={30} />
      </div>
    ),
  },
);
