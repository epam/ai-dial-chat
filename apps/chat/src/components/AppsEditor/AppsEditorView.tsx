import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEditorSteps, PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { AppEditorPreview } from '@/src/components/AppsEditor/AppEditorPreview/AppEditorPreview';
import { EditorForm } from '@/src/components/AppsEditor/EditorForm/EditorForm';
import { AppsEditorFormType } from '@/src/components/AppsEditor/form';
import { MarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/MarketplaceEditorView';

const mobileTabLabels = {
  [MarketplaceEditorSteps.General]: 'Info',
  [MarketplaceEditorSteps.Settings]: 'Settings',
};

interface AppsEditorViewProps {
  onNextClick: () => void;
  onAutoSave: () => void;
}

export const AppsEditorView = ({
  onNextClick,
  onAutoSave,
}: AppsEditorViewProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);

  const screenState = useScreenState();
  const { control } = useFormContext<AppsEditorFormType>();

  const [name, version] = useWatch({
    control,
    name: ['name', 'version'],
  });

  const LeftContent = useMemo(
    () => <EditorForm onNextClick={onNextClick} />,
    [onNextClick],
  );

  const RightContent = useMemo(
    () => <AppEditorPreview onSave={onAutoSave} />,
    [onAutoSave],
  );

  return (
    <MarketplaceEditorView
      leftContent={LeftContent}
      rightContent={RightContent}
      defaultPreviewMode={
        screenState <= ScreenState.MD ? PreviewMode.closed : PreviewMode.half
      }
      closedPreviewLabel={`${t('Preview')}: ${name} v. ${version}`}
      leftTabLabel={t(mobileTabLabels[editorStep])}
      rightQa="entity-preview-settings"
      onLeftMouseLeave={onAutoSave}
    />
  );
};
