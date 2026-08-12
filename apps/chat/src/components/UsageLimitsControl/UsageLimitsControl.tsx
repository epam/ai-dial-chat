import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialProgressBar, DialProgressBarSize } from '@epam/ai-dial-ui-kit';
import {
  type CSSProperties,
  type FC,
  memo,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useDeploymentUsageLimits } from '../../hooks/useDeploymentUsageLimits';
import styles from './UsageLimitsControl.module.scss';

export interface UsageLimitsLabels {
  /** Builds the trigger label with the current monthly value. */
  triggerAriaLabel: (params: { value: string }) => string;
  /** Popover title. */
  popoverTitle: string;
  /** Non-blocking request error. */
  error: string;
  /** Builds the remaining-token text from a locale-formatted number. */
  tokensRemaining: (params: { count: string }) => string;
  /** Builds the monthly progress bar accessible label. */
  progressAriaLabel: (params: { used: string; total: string }) => string;
}

interface Props {
  /** ID of the currently selected deployment. */
  deploymentId: string | undefined;
  /** Whether the selected deployment is currently generating a response. */
  isGenerationInProgress?: boolean;
  /** Localized strings for the trigger and popover. */
  labels: UsageLimitsLabels;
}

export const USAGE_LIMIT_THRESHOLD_PERCENT = 90;

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 6,
});

const UsageLimitsControl: FC<Props> = ({
  deploymentId,
  isGenerationInProgress = false,
  labels,
}) => {
  const { limit, isLoading, hasError, refresh } =
    useDeploymentUsageLimits(deploymentId);
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const wasGenerationInProgressRef = useRef(isGenerationInProgress);
  const hasPendingGenerationRefreshRef = useRef(false);

  useEffect(() => {
    if (wasGenerationInProgressRef.current && !isGenerationInProgress) {
      hasPendingGenerationRefreshRef.current = true;
    }
    wasGenerationInProgressRef.current = isGenerationInProgress;

    if (hasPendingGenerationRefreshRef.current && !isLoading) {
      hasPendingGenerationRefreshRef.current = false;
      refresh();
    }
  }, [isGenerationInProgress, isLoading, refresh]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        /* Restore focus after the pointer event's default focus handling completes. */
        requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  if (!deploymentId || limit == null) {
    return null;
  }

  const isThresholdReached = limit.usedPercent >= USAGE_LIMIT_THRESHOLD_PERCENT;
  const formattedUsed = numberFormatter.format(limit.used);
  const formattedTotal = numberFormatter.format(limit.total);
  const formattedRemaining = numberFormatter.format(limit.remaining);
  const triggerValue = `${limit.usedPercent}%`;
  const ringStyle = {
    '--usage-percent': limit.usedPercent,
  } as CSSProperties;

  const handleTriggerClick = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    refresh();
    requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={mergeClasses(
          'group flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border border-transparent px-1.5 text-secondary transition-colors',
          'hover:border-primary hover:bg-layer-sunken focus-visible:bg-layer-sunken focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-primary',
          'mobile:min-h-11 mobile:min-w-11',
          isOpen && 'border-primary bg-layer-sunken',
          isThresholdReached && 'text-error',
        )}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={labels.triggerAriaLabel({
          value: triggerValue,
        })}
        onClick={handleTriggerClick}
      >
        <span
          className={mergeClasses(
            'dial-tiny-text overflow-hidden whitespace-nowrap transition-all',
            isOpen
              ? 'max-w-20 opacity-100'
              : 'max-w-0 opacity-0 group-hover:max-w-20 group-hover:opacity-100 group-focus-visible:max-w-20 group-focus-visible:opacity-100',
          )}
        >
          {triggerValue}
        </span>
        <span
          aria-hidden
          className={mergeClasses(
            'inline-block size-3.5 shrink-0 rounded-full',
            isThresholdReached ? 'text-error' : 'text-secondary',
            styles.percentageRing,
          )}
          style={ringStyle}
        />
      </button>

      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="absolute bottom-full end-0 z-50 mb-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg bg-layer-raised p-4 shadow-lg focus:outline-none"
        >
          <p id={titleId} className="dial-small-semi-text text-primary">
            {labels.popoverTitle}
          </p>

          {hasError && (
            <p className="dial-tiny-text text-error" aria-live="polite">
              {labels.error}
            </p>
          )}

          <DialProgressBar
            value={limit.usedPercent}
            max={100}
            size={DialProgressBarSize.Small}
            className="w-full"
            ariaLabel={labels.progressAriaLabel({
              used: formattedUsed,
              total: formattedTotal,
            })}
          />

          <p className="dial-tiny-text text-secondary">
            {labels.tokensRemaining({ count: formattedRemaining })}
          </p>
        </div>
      )}
    </div>
  );
};

export default memo(UsageLimitsControl);
