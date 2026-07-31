import type { Step } from '@epam/ai-dial-ui-kit';
import {
  DialSteps,
  GhostButton,
  PrimaryButton,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';

interface Props {
  title?: string;
  steps: Step[];
  currentStep: string;
  navAriaLabel: string;
  isSaving: boolean;
  isSaveDisabled?: boolean;
  cancelButtonLabel: string;
  saveButtonLabel: string;
  onChangeStep: (stepId: string) => void;
  onCancel: () => void;
  onSave: () => void;
  /** Preview label shown when `isPreviewing` is falsy. Required together with `onPreview`. */
  previewButtonLabel?: string;
  /** "Exit preview" label shown when `isPreviewing` is truthy. Required together with `onPreview`. */
  exitPreviewButtonLabel?: string;
  /** Whether the preview pane is currently shown. Toggles the button's label/icon. */
  isPreviewing?: boolean;
  /** Renders the preview/exit-preview button in the trailing action group, before Cancel/Save, only when provided. */
  onPreview?: () => void;
  isPreviewDisabled?: boolean;
}

const EditorHeader: FC<Props> = ({
  title,
  steps,
  currentStep,
  navAriaLabel,
  isSaving,
  isSaveDisabled = false,
  cancelButtonLabel,
  saveButtonLabel,
  onChangeStep,
  onCancel,
  onSave,
  previewButtonLabel,
  exitPreviewButtonLabel,
  isPreviewing = false,
  isPreviewDisabled = false,
  onPreview,
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
      {onPreview && (
        <GhostButton
          type="button"
          label={isPreviewing ? exitPreviewButtonLabel : previewButtonLabel}
          iconBefore={isPreviewing ? <IconEyeOff /> : <IconEye />}
          onClick={onPreview}
          disabled={isPreviewDisabled}
        />
      )}
      {!isPreviewing && (
        <>
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
            disabled={isSaving || isSaveDisabled}
          />
        </>
      )}
    </div>
  </header>
);

export default memo(EditorHeader);
