import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EditorHeader from '../../components/EditorHeader/EditorHeader';
import {
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { ToolsetEditorSteps } from '../../types/toolsets';

interface Props {
  step: ToolsetEditorSteps;
  isSaving: boolean;
  onChangeStep: (stepId: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const ToolsetEditorHeader: FC<Props> = ({
  step,
  isSaving,
  onChangeStep,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();

  const steps = useMemo(
    () => [
      {
        id: ToolsetEditorSteps.General,
        name: t(ToolsetEditorI18nKeys.StepGeneral),
      },
      {
        id: ToolsetEditorSteps.Settings,
        name: t(ToolsetEditorI18nKeys.StepSettings),
      },
    ],
    [t],
  );

  return (
    <EditorHeader
      steps={steps}
      currentStep={step}
      navAriaLabel={t(ToolsetEditorI18nKeys.StepsNavAriaLabel)}
      isSaving={isSaving}
      cancelButtonLabel={t(ButtonsI18nKeys.Cancel)}
      saveButtonLabel={t(ToolsetEditorI18nKeys.SaveButton)}
      onChangeStep={onChangeStep}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};

export default memo(ToolsetEditorHeader);
