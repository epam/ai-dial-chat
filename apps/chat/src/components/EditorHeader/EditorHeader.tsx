import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Dropdown,
  type DropdownItem,
  ElementSize,
  GhostButton,
  GhostIconButton,
  NeutralButton,
  PrimaryButton,
  ProgressBar,
  type Step,
  StepStatus,
} from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronDown,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorI18nKeys } from '../../constants/translation-keys';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';

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

interface StepCircleProps {
  index: number;
  isCurrent: boolean;
  status?: StepStatus;
}

const getStepCircleClassName = (
  isCurrent: boolean,
  status?: StepStatus,
): string => {
  if (isCurrent) return 'bg-control-accent text-control-permanent';
  if (status === StepStatus.ERROR) return 'border border-error text-error';
  return 'border border-primary text-secondary';
};

const StepCircle: FC<StepCircleProps> = ({ index, isCurrent, status }) => (
  <span
    aria-hidden="true"
    className={mergeClasses(
      'dial-tiny-text flex size-6 shrink-0 items-center justify-center rounded-full font-semibold',
      getStepCircleClassName(isCurrent, status),
    )}
  >
    {index + 1}
  </span>
);

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
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStep),
  );
  const currentStepData = steps[currentIndex];

  const mobileMenuItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = [
      {
        key: 'cancel',
        label: cancelButtonLabel,
        onClick: onCancel,
        disabled: isSaving,
      },
    ];
    if (onPreview) {
      items.push({
        key: 'preview',
        label: previewButtonLabel,
        onClick: onPreview,
        disabled: isPreviewDisabled,
      });
    }
    return items;
  }, [
    cancelButtonLabel,
    onCancel,
    isSaving,
    onPreview,
    previewButtonLabel,
    isPreviewDisabled,
  ]);

  const stepMenuItems = useMemo<DropdownItem[]>(
    () =>
      steps.map((step) => ({
        key: step.id,
        label: step.name,
        icon:
          step.id === currentStep ? (
            <IconCheck size={DIAL_ICON_SIZE.SM} className="text-accent" />
          ) : undefined,
        onClick: () => onChangeStep(step.id),
      })),
    [steps, currentStep, onChangeStep],
  );

  if (isMobile) {
    const stepOfTotalLabel = t(EditorI18nKeys.StepOfTotal, {
      current: currentIndex + 1,
      total: steps.length,
    });

    return (
      <header className="flex flex-col gap-2 border-b border-tertiary bg-layer-sunken px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Dropdown items={stepMenuItems} placement="bottom-start">
            <button
              type="button"
              aria-label={navAriaLabel}
              className="flex min-w-0 flex-col items-start rounded-md py-1 text-start hover:bg-control-accent-alpha-hover focus-visible:bg-control-accent-alpha-hover focus-visible:outline focus-visible:outline-primary"
            >
              {title && (
                <span className="dial-tiny-text truncate text-secondary">
                  {title}
                </span>
              )}
              <span className="dial-small-text flex min-w-0 items-center gap-1 truncate font-semibold text-primary">
                <span className="truncate">
                  {stepOfTotalLabel}
                  {currentStepData && <> · {currentStepData.name}</>}
                </span>
                <IconChevronDown
                  size={DIAL_ICON_SIZE.SM}
                  className="shrink-0 text-secondary"
                />
              </span>
            </button>
          </Dropdown>
          <div className="flex shrink-0 items-center gap-2">
            {isPreviewing ? (
              <GhostButton
                label={exitPreviewButtonLabel}
                iconBefore={<IconEyeOff size={DIAL_ICON_SIZE.SM} />}
                onClick={onPreview}
              />
            ) : (
              <>
                <Dropdown items={mobileMenuItems} placement="bottom-end">
                  <GhostIconButton
                    aria-label={t(EditorI18nKeys.MoreActionsLabel)}
                    icon={<IconDotsVertical size={DIAL_ICON_SIZE.SM} />}
                  />
                </Dropdown>
                <PrimaryButton
                  label={saveButtonLabel}
                  onClick={onSave}
                  disabled={isSaving || isSaveDisabled}
                />
              </>
            )}
          </div>
        </div>
        <ProgressBar
          value={currentIndex + 1}
          max={steps.length}
          size={ElementSize.Small}
          aria-label={navAriaLabel}
          aria-valuetext={stepOfTotalLabel}
        />
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between gap-3 border-b border-tertiary bg-layer-sunken px-6 py-3">
      <div className="flex min-w-0 items-center gap-4">
        {title && (
          <h1 className="dial-caption-text truncate text-primary">{title}</h1>
        )}
        <nav
          aria-label={navAriaLabel}
          className="dial-small-text flex items-center"
        >
          <ol className="flex items-center">
            {steps.map((step, index) => {
              const isCurrent = step.id === currentStep;
              return (
                <li key={step.id} className="flex items-center">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="mx-3 w-8 border-t-2 border-secondary"
                    />
                  )}
                  <button
                    type="button"
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => onChangeStep(step.id)}
                    className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-control-accent-alpha-hover focus-visible:bg-control-accent-alpha-hover focus-visible:outline focus-visible:outline-primary"
                  >
                    <StepCircle
                      index={index}
                      isCurrent={isCurrent}
                      status={step.status}
                    />
                    <span
                      className={mergeClasses(
                        'font-semibold',
                        isCurrent ? 'text-primary' : 'text-secondary',
                      )}
                    >
                      {step.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        {onPreview && (
          <GhostButton
            label={isPreviewing ? exitPreviewButtonLabel : previewButtonLabel}
            iconBefore={
              isPreviewing ? (
                <IconEyeOff size={DIAL_ICON_SIZE.SM} />
              ) : (
                <IconEye size={DIAL_ICON_SIZE.SM} />
              )
            }
            onClick={onPreview}
            disabled={isPreviewDisabled}
          />
        )}
        {!isPreviewing && (
          <>
            <NeutralButton
              label={cancelButtonLabel}
              onClick={onCancel}
              disabled={isSaving}
            />
            <PrimaryButton
              label={saveButtonLabel}
              onClick={onSave}
              disabled={isSaving || isSaveDisabled}
            />
          </>
        )}
      </div>
    </header>
  );
};

export default memo(EditorHeader);
