import { useCallback, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';

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
  currentToolset?: ToolsetModel;
  currentStep: ToolsetEditorSteps;
  onTabClick: (tab: ToolsetEditorSteps) => void;
  onSave: (saveDraft?: boolean) => void;
}

export const ToolsetEditorHeader = ({
  currentToolset,
  currentStep,
  onTabClick,
  onSave,
}: ToolsetEditorHeaderProps) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

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
    const isValid = await trigger();

    if (!isValid) {
      setSaveDraftDialog(true);
      return;
    }
    onSave();
  }, [onSave, trigger]);

  const handleCloseConfirmDialog = useCallback(
    (result: boolean) => {
      setSaveDraftDialog(false);
      if (!result) {
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
        heading={t('Invalid fields will not be saved')}
        description={t(
          'Some fields are filled in incorrectly, or required fields are missing. Any invalid fields will not be saved.\n' +
            'Are you sure you want to exit?',
        )}
        confirmLabel={t('Continue editing')}
        cancelLabel={t('Exit')}
        onClose={handleCloseConfirmDialog}
      />
    </>
  );
};
