import { StepStatus } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EditorHeader from '../../components/EditorHeader/EditorHeader';
import { ToolsetEditorSteps } from '../../constants/toolsets';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';

interface Props {
  step: ToolsetEditorSteps;
  isSaving: boolean;
  isSaveDisabled: boolean;
  canOpenSettings: boolean;
  onChangeStep: (stepId: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const ToolsetEditorHeader: FC<Props> = ({
  step,
  isSaving,
  isSaveDisabled,
  canOpenSettings,
  onChangeStep,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();

  const steps = useMemo(
    () => [
      {
        id: ToolsetEditorSteps.General,
        name: t(EditorI18nKeys.StepGeneral),
        status: canOpenSettings ? StepStatus.VALID : undefined,
      },
      {
        id: ToolsetEditorSteps.Settings,
        name: t(BasicI18nKeys.Settings),
        status: canOpenSettings ? StepStatus.VALID : undefined,
      },
    ],
    [t, canOpenSettings],
  );

  return (
    <EditorHeader
      steps={steps}
      currentStep={step}
      navAriaLabel={t(EditorI18nKeys.StepsNavAriaLabel)}
      isSaving={isSaving}
      isSaveDisabled={isSaveDisabled}
      cancelButtonLabel={t(ButtonsI18nKeys.Cancel)}
      saveButtonLabel={t(EditorI18nKeys.SaveButton)}
      onChangeStep={onChangeStep}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};

export default memo(ToolsetEditorHeader);
