import { useCallback, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ToolsetEditorSteps } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

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
  onSave: (saveDraft?: boolean) => void;
}

export const ToolsetEditorHeader = ({
  onTabClick,
  onSave,
}: ToolsetEditorHeaderProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const currentStep = useAppSelector(ToolsetSelectors.selectEditorStep);
  const currentToolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const isEditing = !!currentToolset;

  const [saveDraftDialog, setSaveDraftDialog] = useState(false);

  const { formState, trigger } = useFormContext<ToolsetEditorForm>();
  const errors = formState.errors;

  const errorSteps = useMemo(() => {
    return stepFields.reduce<Set<ToolsetEditorSteps>>(
      (steps, { step, fields }) => {
        if (fields.some((field) => errors[field])) {
          steps.add(step);
        }
        return steps;
      },
      new Set(),
    );
  }, [errors]);

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
        disabled: !isEditing,
      },
    ],
    [isEditing],
  );

  const handleTabClick = useCallback(
    (tab: { key: ToolsetEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  const handleSaveClick = useCallback(async () => {
    if (isEditing) {
      const isValid = await trigger();

      if (!isValid) {
        setSaveDraftDialog(true);
        return;
      }
    }
    onSave();
  }, [isEditing, onSave, trigger]);

  const handleCloseConfirmDialog = useCallback(
    (result: boolean) => {
      setSaveDraftDialog(false);
      if (result) {
        onSave(true);
        return;
      }

      const invalidStep = Array.from(errorSteps)[0];

      if (invalidStep) {
        dispatch(ToolsetActions.setEditorStep(invalidStep));
      }
    },
    [dispatch, errorSteps, onSave],
  );

  return (
    <>
      <EditorHeader
        tabs={tabs}
        activeTab={currentStep}
        errorTabsSet={errorSteps}
        isEditing={isEditing}
        onTabClick={handleTabClick}
        title={t(isEditing ? 'Edit toolset' : 'Add toolset')}
        saveLabel={isEditing ? 'Save and exit' : 'Exit'}
        onSave={handleSaveClick}
      />

      <ConfirmDialog
        isOpen={saveDraftDialog}
        heading={t('Only valid data will be saved')}
        description={t(
          'Some fields are invalid or required fields are missing.\n Changes in those fields will not be saved.\n Exit and save only valid information?',
        )}
        confirmLabel={t('Save valid data')}
        cancelLabel={t('Continue editing')}
        onClose={handleCloseConfirmDialog}
      />
    </>
  );
};
