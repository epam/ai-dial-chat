import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { DialSteps } from '@epam/ai-dial-ui-kit';
import type { Step } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';

interface Props {
  title?: string;
  steps: Step[];
  currentStep: string;
  navAriaLabel: string;
  isSaving: boolean;
  cancelButtonLabel: string;
  saveButtonLabel: string;
  onChangeStep: (stepId: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const EditorHeader: FC<Props> = ({
  title,
  steps,
  currentStep,
  navAriaLabel,
  isSaving,
  cancelButtonLabel,
  saveButtonLabel,
  onChangeStep,
  onCancel,
  onSave,
}) => (
  <header className="flex items-center justify-between gap-3 border-b border-b-tertiary bg-layer-2 px-4 py-1">
    <div className="flex items-center gap-3">
      {title && (
        <h1 className="dial-caption-text justify-start text-primary">
          {title}
        </h1>
      )}
      <nav
        role="navigation"
        aria-label={navAriaLabel}
        className="flex items-center gap-2 text-sm"
      >
        <DialSteps
          steps={steps}
          currentStep={currentStep}
          onChangeStep={onChangeStep}
        />
      </nav>
    </div>
    <div className="flex items-center gap-2">
      <NeutralButton
        type="button"
        label={cancelButtonLabel}
        onClick={onCancel}
        disabled={isSaving}
      />
      <PrimaryButton
        type="button"
        label={saveButtonLabel}
        onClick={onSave}
        disabled={isSaving}
      />
    </div>
  </header>
);

export default memo(EditorHeader);
