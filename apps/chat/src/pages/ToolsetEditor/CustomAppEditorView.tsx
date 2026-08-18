import { NeutralButton, PrimaryButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolsetEditorSteps } from '../../constants/toolsets';
import {
  ButtonsI18nKeys,
  CustomAppI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import type {
  CustomAppFormData,
  CustomAppFormErrors,
  CustomAppGeneralFormData,
} from '../../models/custom-apps';
import type { ToolsetFormErrors } from '../../models/toolsets';
import CustomAppSettingsForm from './EditorForm/CustomAppSettingsForm';
import GeneralForm from './EditorForm/GeneralForm';

interface Props {
  step: ToolsetEditorSteps;
  generalForm: CustomAppGeneralFormData;
  generalErrors: ToolsetFormErrors;
  settingsForm: CustomAppFormData;
  settingsErrors: CustomAppFormErrors;
  isSaving: boolean;
  isNextDisabled: boolean;
  onNext: () => void;
  onCancel: () => void;
  onGeneralChange: (patch: Partial<CustomAppGeneralFormData>) => void;
  onSettingsChange: (patch: Partial<CustomAppFormData>) => void;
  onNameBlur: () => void;
  onVersionBlur: () => void;
}

const CustomAppEditorView: FC<Props> = ({
  step,
  generalForm,
  generalErrors,
  settingsForm,
  settingsErrors,
  isSaving,
  isNextDisabled,
  onNext,
  onCancel,
  onGeneralChange,
  onSettingsChange,
  onNameBlur,
  onVersionBlur,
}) => {
  const { t } = useTranslation();
  const isGeneralStep = step === ToolsetEditorSteps.General;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex h-full w-full min-w-0 flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {isGeneralStep ? (
            <GeneralForm
              form={generalForm}
              errors={generalErrors}
              namePlaceholder={t(CustomAppI18nKeys.NamePlaceholder)}
              descriptionPlaceholder={t(
                CustomAppI18nKeys.DescriptionPlaceholder,
              )}
              onChange={onGeneralChange}
              onNameBlur={onNameBlur}
              onVersionBlur={onVersionBlur}
            />
          ) : (
            <CustomAppSettingsForm
              form={settingsForm}
              errors={settingsErrors}
              onChange={onSettingsChange}
            />
          )}
        </div>

        {isGeneralStep && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-t-tertiary px-4 py-3">
            <NeutralButton
              type="button"
              label={t(ButtonsI18nKeys.Cancel)}
              onClick={onCancel}
              disabled={isSaving}
            />
            <PrimaryButton
              type="button"
              label={t(EditorI18nKeys.NextButton)}
              onClick={onNext}
              disabled={isNextDisabled}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(CustomAppEditorView);
