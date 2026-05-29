import React, {
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { PreviewModeButton } from '@/src/components/Marketplace/MarketplaceEditorView/PreviewModeButton';

import { MarketplaceEditorViewContext } from './marketplaceEditorViewContext';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface MarketplaceEditorViewProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;

  defaultPreviewMode?: PreviewMode;
  onLeftMouseLeave?: (e?: MouseEvent<HTMLDivElement>) => void;
  rightQa?: string;
  closedPreviewLabel?: string;
  leftTabLabel?: string;
}

export const MarketplaceEditorView = ({
  leftContent,
  rightContent,
  previewMode,
  onPreviewModeChange,
  onLeftMouseLeave,
  rightQa,
  closedPreviewLabel,
  leftTabLabel,
}: MarketplaceEditorViewProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const screenState = useScreenState();

  const isPreviewClosed = previewMode === PreviewMode.closed;
  const isPreviewHalf = previewMode === PreviewMode.half;
  const isPreviewFull = previewMode === PreviewMode.full;

  const handleOpenPreview = useCallback(() => {
    if (screenState > ScreenState.MD) {
      onPreviewModeChange(PreviewMode.half);
    } else {
      onPreviewModeChange(PreviewMode.full);
    }
  }, [onPreviewModeChange, screenState]);

  const providerValue = useMemo(
    () => ({
      previewMode,
      changePreviewMode: onPreviewModeChange,
    }),
    [onPreviewModeChange, previewMode],
  );

  useEffect(() => {
    if (screenState <= ScreenState.MD && isPreviewHalf) {
      onPreviewModeChange(PreviewMode.closed);
    }
  }, [onPreviewModeChange, isPreviewHalf, previewMode, screenState]);

  return (
    <MarketplaceEditorViewContext.Provider value={providerValue}>
      <div className="flex size-full min-h-0 flex-col">
        <div className="flex w-full justify-center gap-2 border-b border-primary px-3 py-2 text-primary md:hidden">
          <TabButton
            tabKey={PreviewMode.closed}
            selected={!isPreviewFull}
            onClick={onPreviewModeChange}
            className="w-full"
          >
            {leftTabLabel}
          </TabButton>
          <TabButton
            tabKey={PreviewMode.full}
            selected={isPreviewFull}
            onClick={onPreviewModeChange}
            className="w-full"
          >
            {t(MarketplaceI18nKeys.PreviewMarketplace)}
          </TabButton>
        </div>

        <div className="flex min-h-0 w-full flex-1 overflow-hidden">
          <div
            onMouseLeave={onLeftMouseLeave}
            className={classNames(
              'h-full min-h-0 overflow-hidden transition-all duration-300 ease-in-out',
              {
                'w-[calc(100%-40px)] opacity-100 max-md:w-full':
                  isPreviewClosed,
                'w-1/2 opacity-100': isPreviewHalf,
                'w-0 opacity-0': isPreviewFull,
              },
            )}
          >
            {leftContent}
          </div>

          <div
            className={classNames(
              'flex h-full min-h-0 flex-col transition-all duration-300 ease-in-out',
              {
                'w-1/2 border-l border-secondary opacity-100': isPreviewHalf,
                'w-full opacity-100': isPreviewFull,
                'w-0 overflow-hidden opacity-0': isPreviewClosed,
              },
            )}
            data-qa={rightQa}
          >
            {rightContent}
          </div>

          {isPreviewClosed && (
            <div
              className="flex h-full w-10 flex-col items-center space-y-3 border-l border-secondary pt-4 transition-all duration-300 ease-in-out hover:cursor-pointer max-md:hidden xl:pt-4"
              onClick={handleOpenPreview}
            >
              <PreviewModeButton mode={PreviewMode.full} />
              <PreviewModeButton mode={PreviewMode.half} />

              {!!closedPreviewLabel && (
                <span
                  className="min-h-0 flex-1 select-none text-primary"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  <DialEllipsisTooltip text={closedPreviewLabel} />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </MarketplaceEditorViewContext.Provider>
  );
};
