import dynamic from 'next/dynamic';

import { Spinner } from '@/src/components/Common/Spinner';

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
