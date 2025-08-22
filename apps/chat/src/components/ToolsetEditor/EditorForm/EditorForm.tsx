import { ToolsetEditorSteps } from '@/src/types/toolsets';

import { GeneralForm } from '@/src/components/ToolsetEditor/EditorForm/GeneralForm';
import { SettingsForm } from '@/src/components/ToolsetEditor/EditorForm/SettingsForm';

interface EditorFormProps {
  onNextClick: () => void;
  currentStep: ToolsetEditorSteps;
}

export const EditorForm = ({ onNextClick, currentStep }: EditorFormProps) => {
  switch (currentStep) {
    case ToolsetEditorSteps.General:
      return <GeneralForm onNextClick={onNextClick} />;
    case ToolsetEditorSteps.Settings:
      return <SettingsForm />;
    default:
      return null;
  }
};
