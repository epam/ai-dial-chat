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
import { IconRestore, IconSparkles } from '@tabler/icons-react';
import { useLayoutEffect, useRef, type FC, type ReactNode } from 'react';
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
  /** Caption shown at the end of the row below the control, beside the refinement status — e.g. a character counter. */
  caption?: string;
  /** The refinable control, whose id must equal `fieldId`; it is made read-only while a request is pending. */
  children: ReactNode;
}

/** Label row with Refine, Restore original and Regenerate actions and live feedback around one refinable field. */
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
  caption,
  children,
}) => {
  const controls = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const isPending = isEnabled && refinement.isPending;

  /*
   * The pending field keeps showing the text that was sent but takes no typing.
   * The control's own read-only state comes back once the request settles.
   */
  useLayoutEffect(() => {
    if (!isPending) return;
    const control = Array.from(
      field.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
      ) ?? [],
    ).find((element) => element.id === fieldId);
    if (!control) return;
    const wasReadOnly = control.readOnly;
    control.readOnly = true;
    return () => {
      control.readOnly = wasReadOnly;
    };
  }, [isPending, fieldId]);

  const captionText = caption && (
    <CaptionText text={caption} className="ms-auto shrink-0 text-end" />
  );
  if (!isEnabled) {
    if (!captionText) return <>{children}</>;
    return (
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {captionText}
      </div>
    );
  }
  const error = refinement.state === TextRefinementState.Error;
  const hasResult = refinement.canUndo;
  let actionLabel = labels?.refineWithAiLabel ?? 'Refine with AI';
  if (isPending) actionLabel = labels?.refineRefiningLabel ?? 'Refining';
  else if (hasResult)
    actionLabel = labels?.refineRegenerateLabel ?? 'Regenerate';
  /* The action row already shows these states; only announce them. */
  const isMessageHidden =
    refinement.state === TextRefinementState.Pending ||
    refinement.state === TextRefinementState.Success ||
    refinement.state === TextRefinementState.Restored;
  const message = {
    [TextRefinementState.Idle]: '',
    [TextRefinementState.Pending]:
      labels?.refinePendingAriaLabel ?? 'Refining text',
    [TextRefinementState.Success]:
      labels?.refineSuccessAriaLabel ?? 'Text refined',
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
          {hasResult && !isPending && (
            <GhostButton
              size={ElementSize.Small}
              label={labels?.refineUndoLabel ?? 'Restore original'}
              disabled={disabled}
              onClick={() => {
                refinement.undo();
                /*
                 * This button unmounts; the main action is the same element in
                 * every state and becomes Refine with AI. GhostButton forwards
                 * no ref, so find it as the row's last button.
                 */
                const buttons =
                  controls.current?.querySelectorAll<HTMLButtonElement>(
                    'button',
                  );
                buttons?.[buttons.length - 1]?.focus();
              }}
              iconBefore={
                <IconRestore
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                />
              }
            />
          )}
          <GhostButton
            size={ElementSize.Small}
            label={actionLabel}
            disabled={disabled || !refinement.canRefine}
            onClick={() => {
              void refinement.refine();
            }}
            iconBefore={
              isPending ? (
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
        </div>
      </div>
      <div ref={field} aria-busy={refinement.isPending}>
        {children}
      </div>
      <div className="flex min-w-0 items-start gap-3">
        {/* The live region stays mounted: CaptionText renders nothing for empty text. */}
        <div role="status" aria-live="polite" className="min-w-0 flex-1">
          <CaptionText
            text={message}
            className={mergeClasses(
              feedbackClassName,
              isMessageHidden && 'sr-only',
            )}
          />
        </div>
        {captionText}
      </div>
      {error && (
        <ErrorText
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
