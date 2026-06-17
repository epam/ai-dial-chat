import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useEditorSaveLabel } from '@/src/hooks/useEditorSaveLabel';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isTruthyQuery } from '@/src/utils/app/route';

import { ToolsetEditorSteps } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { EditorHeader } from '@/src/components/Header/EditorHeader';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

const stepFields: {
  step: ToolsetEditorSteps;
  fields: (keyof ToolsetEditorForm)[];
}[] = [
  { step: ToolsetEditorSteps.General, fields: ['name', 'version'] },
  {
    step: ToolsetEditorSteps.Settings,
    fields: ['endpoint', 'clientId', 'clientSecret'],
  },
];

interface ToolsetEditorHeaderProps {
  onTabClick: (tab: ToolsetEditorSteps) => void;
  onSave: (saveDraft?: boolean, redirectToChat?: boolean) => void;
}

export const ToolsetEditorHeader = ({
  onTabClick,
  onSave,
}: ToolsetEditorHeaderProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const {
    query: {
      [ToolsetEditorQuery.Id]: idQuery,
      [ToolsetEditorQuery.IsCreating]: isCreating,
    },
  } = useRouter();

  const dispatch = useAppDispatch();

  const isCreatingToolset = !idQuery || isTruthyQuery(isCreating);

  const currentStep = useAppSelector(ToolsetSelectors.selectEditorStep);
  const currentToolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const isPublicToolset = currentToolset && isEntityIdPublic(currentToolset);

  const isExistingToolset = !!currentToolset;

  const isToolsetDetailsLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );

  const [saveDraftDialog, setSaveDraftDialog] = useState(false);
  const [redirectToChat, setRedirectToChat] = useState(false);

  const { trigger, control } = useFormContext<ToolsetEditorForm>();
  const { errors, isValid } = useFormState<ToolsetEditorForm>({ control });

  useEffect(() => {
    if (isPublicToolset && !isToolsetDetailsLoading) {
      const timerId = setTimeout(() => {
        trigger();
      });
      return () => clearTimeout(timerId);
    }
  }, [dispatch, isPublicToolset, isToolsetDetailsLoading, trigger]);

  const errorSteps = useMemo(() => {
    return stepFields.reduce<Set<ToolsetEditorSteps>>(
      (steps, { step, fields }) => {
        if (!isValid && fields.some((field) => errors[field])) {
          steps.add(step);
        }
        return steps;
      },
      new Set(),
    );
  }, [errors, isValid]);

  const tabs = useMemo(
    () => [
      {
        label: ToolsetEditorSteps.General,
        key: ToolsetEditorSteps.General,
        disabled: false,
      },
      {
        label: ToolsetEditorSteps.Settings,
        key: ToolsetEditorSteps.Settings,
        disabled: !isExistingToolset,
      },
    ],
    [isExistingToolset],
  );

  const handleLogoClick = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (isExistingToolset) {
        const isValid = await trigger();

        if (!isValid && !isPublicToolset) {
          setSaveDraftDialog(true);
          setRedirectToChat(true);
          return;
        }
      }
      onSave(false, true);
    },
    [isExistingToolset, isPublicToolset, onSave, trigger],
  );

  const handleTabClick = useCallback(
    (tab: { key: ToolsetEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  const handleSaveClick = useCallback(async () => {
    if (isExistingToolset) {
      const isValid = await trigger();

      if (!isValid && !isPublicToolset) {
        setSaveDraftDialog(true);
        return;
      }
    }
    onSave();
  }, [isExistingToolset, isPublicToolset, onSave, trigger]);

  const handleCloseConfirmDialog = useCallback(
    (result: boolean) => {
      setSaveDraftDialog(false);
      if (result && redirectToChat) {
        onSave(true, true);
        return;
      } else if (result) {
        onSave(true);
        return;
      }
      setRedirectToChat(false);
      const invalidStep = Array.from(errorSteps)[0];

      if (invalidStep) {
        dispatch(ToolsetActions.setEditorStep(invalidStep));
      }
    },
    [dispatch, errorSteps, onSave, redirectToChat],
  );

  const saveLabel = useEditorSaveLabel(isExistingToolset && !isPublicToolset);

  return (
    <>
      <EditorHeader
        tabs={tabs}
        activeTab={currentStep}
        errorTabsSet={errorSteps}
        isEditing={isExistingToolset}
        onTabClick={handleTabClick}
        title={t(
          isCreatingToolset
            ? MarketplaceI18nKeys.AddToolset
            : MarketplaceI18nKeys.EditToolset,
        )}
        saveLabel={saveLabel}
        onSave={handleSaveClick}
        onLogoClick={handleLogoClick}
        dataQa="entity-editor-header"
      />

      <ConfirmDialog
        isOpen={saveDraftDialog}
        heading={t(MarketplaceI18nKeys.OnlyValidDataWillBeSaved)}
        description={t(MarketplaceI18nKeys.SomeFieldsAreInvalid)}
        confirmLabel={t(MarketplaceI18nKeys.SaveValidData)}
        cancelLabel={t(MarketplaceI18nKeys.ContinueEditing)}
        onClose={handleCloseConfirmDialog}
      />
    </>
  );
};
