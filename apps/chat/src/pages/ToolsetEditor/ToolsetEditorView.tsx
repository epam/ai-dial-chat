import { PrimaryButton, NeutralButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  EditorI18nKeys,
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

interface Props {
  step: ToolsetEditorSteps;
  form: ToolsetFormData;
  errors: ToolsetFormErrors;
  isSaving: boolean;
  toolsetId: string;
  isEditMode: boolean;
  onNext: () => void;
  onCancel: () => void;
  onEnsureSaved: () => Promise<string | false>;
  onChange: (patch: Partial<ToolsetFormData>) => void;
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
}

const ToolsetEditorView: FC<Props> = ({
  step,
  form,
  errors,
  isSaving,
  toolsetId,
  isEditMode,
  onNext,
  onCancel,
  onEnsureSaved,
  onChange,
  onAuthChange,
}) => {
  const { t } = useTranslation();
  const isGeneralStep = step === ToolsetEditorSteps.General;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex h-full w-full min-w-0 flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {isGeneralStep ? (
            <GeneralForm
              form={form}
              errors={errors}
              namePlaceholder={t(ToolsetEditorI18nKeys.NamePlaceholder)}
              descriptionPlaceholder={t(
                ToolsetEditorI18nKeys.DescriptionPlaceholder,
              )}
              onChange={onChange}
            />
          ) : (
            <SettingsForm
              form={form}
              errors={errors}
              isSaving={isSaving}
              toolsetId={toolsetId}
              isEditMode={isEditMode}
              onChange={onChange}
              onAuthChange={onAuthChange}
              onEnsureSaved={onEnsureSaved}
            />
          )}
        </div>

        {isGeneralStep && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-t-tertiary px-4 py-3">
            <NeutralButton
              label={t(ButtonsI18nKeys.Cancel)}
              onClick={onCancel}
              disabled={isSaving}
            />
            <PrimaryButton
              label={t(EditorI18nKeys.NextButton)}
              onClick={onNext}
              disabled={isSaving}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ToolsetEditorView);
