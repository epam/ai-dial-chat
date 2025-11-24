import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  ApiDetailedApplicationTypeSchema,
  ApplicationTypeSchemaProperties,
} from '@/src/types/application-type-schema';
import { ScreenState } from '@/src/types/common';
import { MarketplaceEditorSteps, PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
} from '@/src/store/selectors';

import { AppEditorPreview } from '@/src/components/AppsEditor/AppEditorPreview/AppEditorPreview';
import { EditorForm } from '@/src/components/AppsEditor/EditorForm/EditorForm';
import { AppsEditorFormType } from '@/src/components/AppsEditor/form';
import { MarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/MarketplaceEditorView';

const mobileTabLabels = {
  [MarketplaceEditorSteps.General]: 'Info',
  [MarketplaceEditorSteps.Settings]: 'Settings',
};

const getDefaultPreviewMode = (
  screenState: ScreenState,
  editorStep: MarketplaceEditorSteps,
  schema?: ApiDetailedApplicationTypeSchema | null,
) =>
  screenState <= ScreenState.MD ||
  (schema?.[ApplicationTypeSchemaProperties.applicationTypeViewerUrl] &&
    editorStep === MarketplaceEditorSteps.Settings)
    ? PreviewMode.closed
    : PreviewMode.half;

interface AppsEditorViewProps {
  onNextClick: () => void;
  onAutoSave: () => void;
}

export const AppsEditorView = ({
  onNextClick,
  onAutoSave,
}: AppsEditorViewProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const settingsVisitedRef = useRef(false);

  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const screenState = useScreenState();
  const { control } = useFormContext<AppsEditorFormType>();

  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    getDefaultPreviewMode(screenState, editorStep, schema),
  );

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

  useEffect(() => {
    if (
      editorStep === MarketplaceEditorSteps.Settings &&
      !settingsVisitedRef.current
    ) {
      setPreviewMode(getDefaultPreviewMode(screenState, editorStep, schema));
      settingsVisitedRef.current = true;
    }
  }, [editorStep, schema, screenState]);

  return (
    <MarketplaceEditorView
      leftContent={LeftContent}
      rightContent={RightContent}
      previewMode={previewMode}
      onPreviewModeChange={setPreviewMode}
      closedPreviewLabel={`${t('Preview')}: ${name} v. ${version}`}
      leftTabLabel={t(mobileTabLabels[editorStep])}
      rightQa="app-preview-settings"
      onLeftMouseLeave={onAutoSave}
    />
  );
};
