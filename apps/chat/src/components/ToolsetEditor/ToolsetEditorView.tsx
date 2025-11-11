import React, { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { PreviewMode } from '@/src/types/marketplace';
import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { Spinner } from '@/src/components/Common/Spinner';
import { MarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/MarketplaceEditorView';
import { EditorForm } from '@/src/components/ToolsetEditor/EditorForm/EditorForm';
import { ToolsetPreview } from '@/src/components/ToolsetEditor/ToolsetPreview';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

interface ToolsetEditorViewProps {
  onNextClick: (e: React.FormEvent<HTMLFormElement>) => void;
  currentToolset?: ToolsetModel;
  currentStep: ToolsetEditorSteps;
  disableLoader?: boolean;
}

export const ToolsetEditorView = ({
  onNextClick,
  currentToolset,
  currentStep,
  disableLoader,
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

  const LeftContent = useMemo(
    () =>
      isToolsetDetailsLoading && !disableLoader ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={45} className="mx-auto" />
        </div>
      ) : (
        <EditorForm onNextClick={onNextClick} currentStep={currentStep} />
      ),
    [currentStep, disableLoader, isToolsetDetailsLoading, onNextClick],
  );

  const RightContent = useMemo(
    () => (
      <div className="flex-1 overflow-auto">
        <ToolsetPreview currentToolset={currentToolset} />
      </div>
    ),
    [currentToolset],
  );

  return (
    <MarketplaceEditorView
      leftContent={LeftContent}
      rightContent={RightContent}
      defaultPreviewMode={
        screenState <= ScreenState.MD ? PreviewMode.closed : PreviewMode.half
      }
      closedPreviewLabel={`${t('Preview')}: ${name} v. ${version}`}
      leftTabLabel={t('Info')}
    />
  );
};
