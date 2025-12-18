import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react';
import React, { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { Tooltip } from '@/src/components/Common/Tooltip';
import { useMarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/marketplaceEditorViewContext';

const previewModeIcons = {
  [PreviewMode.full]: IconArrowsMaximize,
  [PreviewMode.closed]: IconArrowsMinimize,
  [PreviewMode.half]: IconLayoutSidebarRightCollapse,
};
const previewModeTooltips = {
  [PreviewMode.full]: 'Expand preview',
  [PreviewMode.closed]: 'Hide preview',
  [PreviewMode.half]: 'Split preview',
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
    <button
      className={classNames(
        'text-secondary hover:text-accent-primary',
        className,
      )}
      onClick={handlePreviewModeChange}
    >
      <Tooltip tooltip={t(previewModeTooltips[mode])}>
        <Icon size={size} />
      </Tooltip>
    </button>
  );
};
