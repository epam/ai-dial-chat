import {
  CaptionText,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  ErrorText,
  GhostButton,
  Label,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconSparkles } from '@tabler/icons-react';
import { useRef, type FC, type ReactNode } from 'react';
import {
  TextRefinementState,
  type TextRefinementResult,
} from '../../hooks/useTextRefinement';
import type { TextRefinementLabels } from '../../models/text-refinement';
import { mergeClasses } from '../../utils/merge-class';

/** Props for `TextRefinementField`. */
export interface TextRefinementFieldProps {
  /** When false, renders `children` alone — no label row, actions, or feedback. */
  isEnabled: boolean;
  /** Id of the labelled control; also the prefix for the label and error ids. */
  fieldId: string;
  /** Visible field label; names the group. */
  label: string;
  /** Class applied to the `<label>`, after the kit `Label` defaults. */
  labelClassName?: string;
  /** Marks the label as required. */
  required?: boolean;
  /** Action, status, and error copy. */
  labels?: TextRefinementLabels;
  /** The field's `useTextRefinement` result. */
  refinement: TextRefinementResult;
  /** Disables both actions. */
  disabled: boolean;
  /** Class applied to the status message and the error message. */
  feedbackClassName?: string;
  /** Class applied to the error message, after `feedbackClassName`. */
  errorClassName?: string;
  /** The refinable control, whose id must equal `fieldId`. */
  children: ReactNode;
}

/** Label row with Refine/Undo actions and live feedback around one refinable field. */
export const TextRefinementField: FC<TextRefinementFieldProps> = ({
  isEnabled,
  fieldId,
  label,
  labelClassName,
  required,
  labels,
  refinement,
  disabled,
  feedbackClassName,
  errorClassName,
  children,
}) => {
  const controls = useRef<HTMLDivElement>(null);
  if (!isEnabled) return <>{children}</>;
  const error = refinement.state === TextRefinementState.Error;
  const message = {
    [TextRefinementState.Idle]: '',
    [TextRefinementState.Pending]:
      labels?.refinePendingAriaLabel ?? 'Refining text',
    [TextRefinementState.Success]:
      labels?.refineSuccessAriaLabel ?? 'Text refined. Undo is available.',
    [TextRefinementState.Restored]:
      labels?.refineUndoAriaLabel ?? 'Original text restored.',
    [TextRefinementState.Unchanged]:
      labels?.refineUnchangedAriaLabel ?? 'No changes were needed.',
    [TextRefinementState.Error]: '',
  }[refinement.state];
  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      role="group"
      aria-labelledby={fieldId + '-label'}
      aria-describedby={error ? fieldId + '-refinement-error' : undefined}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3">
        <Label
          id={fieldId + '-label'}
          htmlFor={fieldId}
          className={labelClassName}
          label={label}
          required={required}
        />
        <div
          ref={controls}
          className="ms-auto flex min-w-0 flex-wrap items-center"
        >
          <GhostButton
            size={ElementSize.Small}
            label={labels?.refineWithAiLabel ?? 'Refine with AI'}
            disabled={disabled || !refinement.canRefine}
            onClick={() => {
              void refinement.refine();
            }}
            iconBefore={
              refinement.isPending ? (
                <span aria-hidden>
                  <Spinner size={DIAL_ICON_SIZE.SM} ariaLabel="" />
                </span>
              ) : (
                <IconSparkles
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                />
              )
            }
          />
          {refinement.canUndo && (
            <GhostButton
              size={ElementSize.Small}
              label={labels?.refineUndoLabel ?? 'Undo'}
              disabled={disabled}
              onClick={() => {
                refinement.undo();
                /* GhostButton forwards no ref, so find the Refine action. */
                controls.current
                  ?.querySelector<HTMLButtonElement>('button')
                  ?.focus();
              }}
            />
          )}
        </div>
      </div>
      <div aria-busy={refinement.isPending}>{children}</div>
      {/* The live region stays mounted: CaptionText renders nothing for empty text. */}
      <div role="status" aria-live="polite">
        <CaptionText text={message} className={feedbackClassName} />
      </div>
      {error && (
        <ErrorText
          role="alert"
          id={fieldId + '-refinement-error'}
          className={mergeClasses(feedbackClassName, errorClassName)}
          text={
            labels?.refineErrorLabel ??
            'Could not refine this text. Please try again.'
          }
        />
      )}
    </div>
  );
};
