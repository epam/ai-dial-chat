import { DialNotification, NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
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
  saveError: string;
  isSaving: boolean;
  toolsetId: string;
  onChange: (patch: Partial<ToolsetFormData>) => void;
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
}

const ToolsetEditorView: FC<Props> = ({
  step,
  form,
  errors,
  saveError,
  isSaving,
  toolsetId,
  onChange,
  onAuthChange,
}) => {
  const isGeneralStep = step === ToolsetEditorSteps.General;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex h-full w-1/2 flex-col gap-4 overflow-y-auto border-e border-e-primary p-4">
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

        {saveError && (
          <DialNotification
            variant={NotificationVariant.Error}
            message={saveError}
          />
        )}
      </div>

      <ToolsetPreview form={form} />
    </div>
  );
};

export default memo(ToolsetEditorView);
