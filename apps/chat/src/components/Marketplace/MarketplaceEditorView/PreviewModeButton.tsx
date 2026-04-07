import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutSidebarLeftCollapse,
} from '@tabler/icons-react';
import React, { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { useMarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/marketplaceEditorViewContext';

import { DialGhostIconButton } from '@epam/ai-dial-ui-kit';

const previewModeIcons = {
  [PreviewMode.full]: IconArrowsMaximize,
  [PreviewMode.closed]: IconArrowsMinimize,
  [PreviewMode.half]: IconLayoutSidebarLeftCollapse,
};
const previewModeTooltips = {
  [PreviewMode.full]: MarketplaceI18nKeys.ExpandPreview,
  [PreviewMode.closed]: MarketplaceI18nKeys.HidePreview,
  [PreviewMode.half]: MarketplaceI18nKeys.SplitPreview,
};

interface PreviewModeButtonProps {
  mode: PreviewMode;
  className?: string;
  size?: number;
}

export const PreviewModeButton = ({
  mode,
  className,
  size = 24,
}: PreviewModeButtonProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const { changePreviewMode } = useMarketplaceEditorView();

  const Icon = useMemo(() => previewModeIcons[mode], [mode]);

  const handlePreviewModeChange = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      changePreviewMode(mode);
    },
    [mode, changePreviewMode],
  );

  return (
    <DialGhostIconButton
      className={className}
      onClick={handlePreviewModeChange}
      icon={<Icon size={size} />}
      tooltipProps={{
        tooltip: t(previewModeTooltips[mode]),
        isTriggerClickable: true,
      }}
    />
  );
};
