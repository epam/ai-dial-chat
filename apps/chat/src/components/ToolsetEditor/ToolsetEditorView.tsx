import { IconArrowsMaximize } from '@tabler/icons-react';
import { useState } from 'react';

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

  return (
    <div className="flex size-full grow overflow-hidden">
      <div className="flex w-full justify-center gap-2 border-b border-primary px-3 py-2 text-primary md:hidden">
        <TabButton
          selected={isPreviewClosed}
          onClick={() => handlePreviewModeChange(PreviewMode.closed)}
          className="w-full"
        >
          {t('Info')}
        </TabButton>
        <TabButton
          selected={isPreviewFull}
          onClick={() => handlePreviewModeChange(PreviewMode.full)}
          className="w-full"
        >
          {t('Preview')}
        </TabButton>
      </div>

      <div
        className={classNames(
          'overflow-hidden transition-all duration-300 ease-in-out',
          {
            'grow opacity-100': isPreviewClosed,
            'size-full': isPreviewHalf,
            'size-0 opacity-0': isPreviewFull,
          },
        )}
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
          'relative flex min-h-0 flex-col overflow-hidden border-l border-primary transition-all duration-300 ease-in-out',
          {
            'w-full opacity-100': isPreviewFull,
            'size-full grow': isPreviewHalf,
            'absolute w-0 opacity-0': isPreviewClosed,
          },
        )}
      >
        <ToolsetPreview currentToolset={currentToolset} />
      </div>

      {isPreviewClosed && (
        <div
          className="hidden h-full w-10 flex-col items-center space-y-3 border-l border-primary pt-4 hover:cursor-pointer md:flex"
          onClick={handleFullModeClick}
        >
          <button className="text-secondary hover:text-accent-primary">
            <Tooltip tooltip={t('Expand preview')}>
              <IconArrowsMaximize size={24} />
            </Tooltip>
          </button>
          <span
            className="select-none text-primary"
            style={{ writingMode: 'vertical-rl' }}
          >
            {t('Preview')}
          </span>
        </div>
      )}
    </div>
  );
};
