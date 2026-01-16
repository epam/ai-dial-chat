import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ToolsetEditorSteps } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

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

  const isCreatingToolset =
    !idQuery || (typeof isCreating === 'string' && isCreating === '1');

  const currentStep = useAppSelector(ToolsetSelectors.selectEditorStep);
  const currentToolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const isExistingToolset = !!currentToolset;

  const [saveDraftDialog, setSaveDraftDialog] = useState(false);
  const [redirectToChat, setRedirectToChat] = useState(false);

  const { trigger, control } = useFormContext<ToolsetEditorForm>();
  const { errors, isValid } = useFormState<ToolsetEditorForm>({ control });

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

        if (!isValid) {
          setSaveDraftDialog(true);
          setRedirectToChat(true);
          return;
        }
      }
      onSave(false, true);
    },
    [isExistingToolset, onSave, trigger],
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

      if (!isValid) {
        setSaveDraftDialog(true);
        return;
      }
    }
    onSave();
  }, [isExistingToolset, onSave, trigger]);

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

  const saveLabel =
    isExistingToolset &&
    (currentToolset ? !isEntityIdPublic(currentToolset) : false)
      ? 'Save and exit'
      : 'Exit';

  return (
    <>
      <EditorHeader
        tabs={tabs}
        activeTab={currentStep}
        errorTabsSet={errorSteps}
        isEditing={isExistingToolset}
        onTabClick={handleTabClick}
        title={t(isCreatingToolset ? 'Add toolset' : 'Edit toolset')}
        saveLabel={saveLabel}
        onSave={handleSaveClick}
        onLogoClick={handleLogoClick}
        dataQa="entity-editor-header"
      />

      <ConfirmDialog
        isOpen={saveDraftDialog}
        heading={t('Only valid data will be saved')}
        description={t(
          'Some fields are invalid or required fields are missing.\nChanges in those fields will not be saved.\nExit and save only valid information?',
        )}
        confirmLabel={t('Save valid data')}
        cancelLabel={t('Continue editing')}
        onClose={handleCloseConfirmDialog}
      />
    </>
  );
};
