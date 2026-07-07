import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../types/toolsets';
import { ToolsetEditorSteps } from '../../types/toolsets';
import GeneralForm from './EditorForm/GeneralForm';
import SettingsForm from './EditorForm/SettingsForm';
import ToolsetPreview from './ToolsetPreview';

interface Props {
  step: ToolsetEditorSteps;
  form: ToolsetFormData;
  errors: ToolsetFormErrors;
  isSaving: boolean;
  toolsetId: string;
  onNext: () => void;
  onCancel: () => void;
  onChange: (patch: Partial<ToolsetFormData>) => void;
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
}

const ToolsetEditorView: FC<Props> = ({
  step,
  form,
  errors,
  isSaving,
  toolsetId,
  onNext,
  onCancel,
  onChange,
  onAuthChange,
}) => {
  const { t } = useTranslation();
  const isGeneralStep = step === ToolsetEditorSteps.General;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex h-full w-1/2 flex-col border-e border-e-primary">
        <div className="flex-1 overflow-y-auto p-4">
          {isGeneralStep ? (
            <GeneralForm form={form} errors={errors} onChange={onChange} />
          ) : (
            <SettingsForm
              form={form}
              errors={errors}
              isSaving={isSaving}
              toolsetId={toolsetId}
              onChange={onChange}
              onAuthChange={onAuthChange}
            />
          )}
        </div>

        {isGeneralStep && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-t-primary px-4 py-3">
            <NeutralButton
              type="button"
              label={t(ButtonsI18nKeys.Cancel)}
              onClick={onCancel}
            />
            <PrimaryButton
              type="button"
              label={t(ToolsetEditorI18nKeys.NextButton)}
              onClick={onNext}
            />
          </div>
        )}
      </div>

      <ToolsetPreview form={form} />
    </div>
  );
};

export default memo(ToolsetEditorView);
