import {
  mergeClasses,
  TextRefinementState,
  type TextRefinementResult,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconSparkles } from '@tabler/icons-react';
import { useRef, type FC, type ReactNode } from 'react';
import type { SkillEditorLabels } from '../../models/skill-editor-props';

interface RefinementFieldProps {
  enabled: boolean;
  fieldId: string;
  label: string;
  labelClassName?: string;
  required?: boolean;
  labels?: SkillEditorLabels;
  refinement: TextRefinementResult;
  disabled: boolean;
  actionClassName: string;
  feedbackClassName: string;
  errorClassName: string;
  children: ReactNode;
}

/** Private label row and field-local refinement feedback. */
export const RefinementField: FC<RefinementFieldProps> = ({
  enabled,
  fieldId,
  label,
  labelClassName,
  required,
  labels,
  refinement,
  disabled,
  actionClassName,
  feedbackClassName,
  errorClassName,
  children,
}) => {
  const controls = useRef<HTMLDivElement>(null);
  if (!enabled) return <>{children}</>;
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
        <label
          id={fieldId + '-label'}
          htmlFor={fieldId}
          className={labelClassName}
        >
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
        <div
          ref={controls}
          className="ms-auto flex min-w-0 flex-wrap items-center"
        >
          <GhostButton
            type="button"
            className={mergeClasses(
              'min-h-[44px] min-w-[44px] whitespace-normal',
              actionClassName,
            )}
            textClassName="[font:inherit]"
            label={labels?.refineWithAiLabel ?? 'Refine with AI'}
            disabled={disabled || !refinement.canRefine}
            onClick={() => {
              void refinement.refine();
            }}
            iconBefore={
              refinement.isPending ? (
                <span aria-hidden>
                  <Spinner size={16} ariaLabel="" />
                </span>
              ) : (
                <IconSparkles
                  size={16}
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                />
              )
            }
          />
          {refinement.canUndo && (
            <GhostButton
              type="button"
              className={mergeClasses(
                'min-h-[44px] min-w-[44px] whitespace-normal',
                actionClassName,
              )}
              textClassName="[font:inherit]"
              label={labels?.refineUndoLabel ?? 'Undo'}
              disabled={disabled}
              onClick={() => {
                refinement.undo();
                controls.current
                  ?.querySelector<HTMLButtonElement>('button')
                  ?.focus();
              }}
            />
          )}
        </div>
      </div>
      <div aria-busy={refinement.isPending}>{children}</div>
      <div role="status" aria-live="polite" className={feedbackClassName}>
        {message}
      </div>
      {error && (
        <div
          role="alert"
          id={fieldId + '-refinement-error'}
          className={mergeClasses(feedbackClassName, errorClassName)}
        >
          {labels?.refineErrorLabel ??
            'Could not refine this text. Please try again.'}
        </div>
      )}
    </div>
  );
};
