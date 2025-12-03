import { createContext, useContext } from 'react';

import { PreviewMode } from '@/src/types/marketplace';

export const MarketplaceEditorViewContext = createContext<{
  previewMode: PreviewMode;
  changePreviewMode: (mode: PreviewMode) => void;
}>({
  previewMode: PreviewMode.closed,
  changePreviewMode: () => undefined,
});

export const useMarketplaceEditorView = () =>
  useContext(MarketplaceEditorViewContext);
