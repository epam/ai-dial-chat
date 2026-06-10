import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalAppEditor } from '@/src/utils/app/application';

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

import { AppsEditorQuery } from '@/src/constants/applications';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { AppEditorPreview } from '@/src/components/AppsEditor/AppEditorPreview/AppEditorPreview';
import { EditorForm } from '@/src/components/AppsEditor/EditorForm/EditorForm';
import { AppsEditorFormType } from '@/src/components/AppsEditor/form';
import { MarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/MarketplaceEditorView';

const mobileTabLabels = {
  [MarketplaceEditorSteps.General]: MarketplaceI18nKeys.InfoMarketplace,
  [MarketplaceEditorSteps.Settings]: MarketplaceI18nKeys.SettingsMarketplace,
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
  onAutoSave: (isSimpleViewSwitch?: boolean, ignoreDirty?: boolean) => void;
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
  const router = useRouter();
  const isExternalAppEditing = useMemo(() => {
    const { [AppsEditorQuery.Schema]: typeQuery = '' } = router.query;
    const type = decodeURIComponent(typeQuery.toString());
    return isExternalAppEditor(type);
  }, [router.query]);
  const hasCustomEditor =
    !!schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl];

  useEffect(() => {
    if (
      (editorStep === MarketplaceEditorSteps.General || isExternalAppEditing) &&
      previewMode !== PreviewMode.half &&
      screenState > ScreenState.MD
    ) {
      setPreviewMode(PreviewMode.half);
    } else if (
      !hasCustomEditor &&
      editorStep === MarketplaceEditorSteps.Settings &&
      previewMode === PreviewMode.closed &&
      screenState > ScreenState.MD
    ) {
      setPreviewMode(PreviewMode.half);
    }
  }, [
    editorStep,
    hasCustomEditor,
    isExternalAppEditing,
    previewMode,
    schema,
    screenState,
  ]);

  const [name, version] = useWatch({
    control,
    name: ['name', 'version'],
  });

  const LeftContent = useMemo(
    () => <EditorForm onNextClick={onNextClick} onAutoSave={onAutoSave} />,
    [onAutoSave, onNextClick],
  );

  const RightContent = useMemo(
    () => <AppEditorPreview onSave={onAutoSave} />,
    [onAutoSave],
  );

  const handlePureAutoSave = useCallback(() => onAutoSave(), [onAutoSave]);

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
      closedPreviewLabel={`${t(MarketplaceI18nKeys.PreviewMarketplace)}: ${name} v. ${version}`}
      leftTabLabel={t(mobileTabLabels[editorStep])}
      rightQa="entity-preview-settings"
      onLeftMouseLeave={handlePureAutoSave}
    />
  );
};
