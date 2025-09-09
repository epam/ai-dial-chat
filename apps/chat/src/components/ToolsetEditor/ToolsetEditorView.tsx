import {
  IconArrowsMaximize,
  IconLayoutSidebarLeftCollapse,
} from '@tabler/icons-react';
import React, { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { PreviewMode } from '@/src/types/marketplace';
import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { EditorForm } from '@/src/components/ToolsetEditor/EditorForm/EditorForm';
import { ToolsetPreview } from '@/src/components/ToolsetEditor/ToolsetPreview';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

interface ToolsetEditorViewProps {
  onNextClick: (e: React.FormEvent<HTMLFormElement>) => void;
  currentToolset?: ToolsetModel;
  currentStep: ToolsetEditorSteps;
}

export const ToolsetEditorView = ({
  onNextClick,
  currentToolset,
  currentStep,
}: ToolsetEditorViewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const screenState = useScreenState();

  const isToolsetDetailsLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );

  const { control } = useFormContext<ToolsetEditorForm>();

  const [name, version] = useWatch({
    control,
    name: ['name', 'version'],
  });

  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    screenState <= ScreenState.MD ? PreviewMode.closed : PreviewMode.half,
  );
  const isPreviewClosed = previewMode === PreviewMode.closed;
  const isPreviewHalf = previewMode === PreviewMode.half;
  const isPreviewFull = previewMode === PreviewMode.full;

  const handlePreviewModeChange = (mode: PreviewMode) => {
    setPreviewMode(mode);
  };

  const handleFullModeClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    handlePreviewModeChange(PreviewMode.full);
  };

  const handleOpenPreview = () => {
    if (screenState > ScreenState.MD) {
      handlePreviewModeChange(PreviewMode.half);
    } else {
      handlePreviewModeChange(PreviewMode.full);
    }
  };

  return (
    <div className="flex size-full flex-col">
      <div className="flex w-full justify-center gap-2 border-b border-primary px-3 py-2 text-primary md:hidden">
        <TabButton
          tabKey={PreviewMode.closed}
          selected={isPreviewClosed}
          onClick={handlePreviewModeChange}
          className="w-full"
        >
          {t('Info')}
        </TabButton>
        <TabButton
          tabKey={PreviewMode.full}
          selected={isPreviewFull}
          onClick={handlePreviewModeChange}
          className="w-full"
        >
          {t('Preview')}
        </TabButton>
      </div>

      <div className="flex w-full grow overflow-hidden">
        <div
          className={classNames('transition-all duration-300 ease-in-out', {
            'w-[calc(100%-40px)] opacity-100 max-md:w-full': isPreviewClosed,
            'w-1/2 opacity-100': isPreviewHalf,
            'w-0 opacity-0': isPreviewFull,
          })}
        >
          {isToolsetDetailsLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size={45} className="mx-auto" />
            </div>
          ) : (
            <EditorForm onNextClick={onNextClick} currentStep={currentStep} />
          )}
        </div>

        <div
          className={classNames(
            'flex h-full flex-col border-l border-primary transition-all duration-300 ease-in-out',
            {
              'w-1/2 opacity-100': isPreviewHalf,
              'w-full opacity-100': isPreviewFull,
              'w-0 overflow-hidden opacity-0': isPreviewClosed,
            },
          )}
        >
          {!isPreviewClosed && (
            <div className="flex-1 overflow-auto">
              <ToolsetPreview
                currentToolset={currentToolset}
                onClosePreview={() =>
                  handlePreviewModeChange(PreviewMode.closed)
                }
              />
            </div>
          )}
        </div>

        {isPreviewClosed && (
          <div
            className="flex h-full w-10 flex-col items-center space-y-3 border-l border-primary pt-4 transition-all duration-300 ease-in-out hover:cursor-pointer max-md:hidden xl:pt-4"
            onClick={handleOpenPreview}
          >
            <button
              className="text-secondary hover:text-accent-primary"
              onClick={handleFullModeClick}
            >
              <Tooltip tooltip={t('Expand preview')}>
                <IconArrowsMaximize size={24} />
              </Tooltip>
            </button>

            <button
              className="text-secondary hover:text-accent-primary max-xl:hidden"
              onClick={() => handlePreviewModeChange(PreviewMode.half)}
            >
              <Tooltip tooltip={t('Split view')}>
                <IconLayoutSidebarLeftCollapse size={24} />
              </Tooltip>
            </button>

            <span
              className="select-none text-primary"
              style={{ writingMode: 'vertical-rl' }}
            >
              {t('Preview')}: {name} v. {version}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
