import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { DialSteps } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
    <header className="flex items-center justify-between border-b border-b-primary bg-layer-2 px-4 py-1">
      <nav
        role="navigation"
        aria-label={t(ToolsetEditorI18nKeys.StepsNavAriaLabel)}
        className="flex items-center gap-2 text-sm"
      >
        <DialSteps
          steps={steps}
          currentStep={step}
          onChangeStep={onChangeStep}
        />
      </nav>
      <div className="flex items-center gap-2">
        <NeutralButton
          type="button"
          label={t(ButtonsI18nKeys.Cancel)}
          onClick={onCancel}
          disabled={isSaving}
        />
        <PrimaryButton
          type="button"
          label={t(ToolsetEditorI18nKeys.SaveButton)}
          onClick={onSave}
          disabled={isSaving}
        />
      </div>
    </header>
  );
};

export default memo(ToolsetEditorHeader);
