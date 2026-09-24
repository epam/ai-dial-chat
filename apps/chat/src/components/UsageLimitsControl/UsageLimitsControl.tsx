import { CatalogLimitStatus, LimitsTab } from '@epam/ai-dial-catalog';
import { mapDeploymentLimitsToInput } from '@epam/ai-dial-chat-hooks';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  type CSSProperties,
  type FC,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ConversationInputI18nKeys } from '../../constants/translation-keys';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useDeploymentUsageLimits } from '../../hooks/useDeploymentUsageLimits';
import { findWorstCappedRow } from '../../utils/usage-limits';
import { formatUsageResetTime } from '../../utils/usage-reset-time';
import styles from './UsageLimitsControl.module.scss';

interface Props {
  /** ID of the currently selected deployment. */
  deploymentId: string | undefined;
  /** Whether the selected deployment is currently generating a response. */
  isGenerationInProgress?: boolean;
}

const UsageLimitsControl: FC<Props> = ({
  deploymentId,
  isGenerationInProgress = false,
}) => {
  /* Widened to the plain key/params signature `formatUsageResetTime` and the
     labels callbacks take, matching `UsageTab`'s own cast. */
  const { t } = useTranslation() as {
    t: (key: string, params?: Record<string, unknown>) => string;
  };
  const { language: activeLocale } = useLanguage();
  const { limitsDto, isLoading, hasError, refresh } =
    useDeploymentUsageLimits(deploymentId);
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const wasGenerationInProgressRef = useRef(isGenerationInProgress);
  const hasPendingGenerationRefreshRef = useRef(false);

  const labels = useMemo(
    () => ({
      tokenGroup: t(ConversationInputI18nKeys.TokenGroup),
      tokensPerDay: t(ConversationInputI18nKeys.TokensPerDay),
      tokensPerWeek: t(ConversationInputI18nKeys.TokensPerWeek),
      tokensPerMonth: t(ConversationInputI18nKeys.TokensPerMonth),
      followsCostLimit: t(ConversationInputI18nKeys.FollowsCostLimit),
      formatSpentCaption: (amount: string) =>
        t(ConversationInputI18nKeys.SpentLabel, { amount }),
      formatValueLabel: (used: string, total: string) =>
        t(ConversationInputI18nKeys.Value, { used, total }),
      formatProgressAriaLabel: (params: {
        label: string;
        used: string;
        total: string;
      }) => t(ConversationInputI18nKeys.ProgressAriaLabel, params),
      formatFollowsCostLimitAriaLabel: (params: {
        label: string;
        used: string;
      }) => t(ConversationInputI18nKeys.FollowsCostLimitAriaLabel, params),
    }),
    [t],
  );

  /*
   * Kept `useCallback`-stable: it feeds the `useMemo` below, so an unstable
   * identity would remap on every render.
   */
  const formatResetTime = useCallback(
    (resetsAt: string | undefined) =>
      formatUsageResetTime(resetsAt, activeLocale, t),
    [activeLocale, t],
  );

  const limits = useMemo(
    () => mapDeploymentLimitsToInput(limitsDto, labels, formatResetTime),
    [limitsDto, labels, formatResetTime],
  );

  const worstRow = useMemo(() => findWorstCappedRow(limits), [limits]);

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

  if (!deploymentId || limits == null) {
    return null;
  }

  const isLimitReached = limits.status === CatalogLimitStatus.LimitReached;
  const isRunningLow = limits.status === CatalogLimitStatus.RunningLow;
  const triggerValue = `${worstRow?.usedPercent ?? 0}%`;
  const ringStyle = {
    '--usage-percent': worstRow?.usedPercent ?? 0,
  } as CSSProperties;

  /*
   * Sets both the percentage text and, through `currentColor`, the ring's
   * filled arc — so the text token is the one that has to be legible.
   * `text-warning-icon` is the icon-weight yellow and would be unreadable as
   * text.
   */
  const getStatusTextClass = () => {
    if (isLimitReached) return 'text-error';
    if (isRunningLow) return 'text-warning';
    return 'text-secondary';
  };

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
          'group flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border border-transparent px-1.5 transition-colors',
          'hover:border-primary hover:bg-layer-sunken focus-visible:bg-layer-sunken focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-primary',
          'mobile:min-h-11 mobile:min-w-11',
          isOpen && 'border-primary bg-layer-sunken',
          getStatusTextClass(),
        )}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t(ConversationInputI18nKeys.TriggerAriaLabel, {
          label: worstRow?.label ?? labels.tokenGroup,
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
          className="absolute bottom-full end-0 z-50 mb-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg bg-layer-raised p-4 shadow-lg focus:outline-none"
        >
          <p id={titleId} className="dial-small-semi-text text-primary">
            {t(ConversationInputI18nKeys.PopoverTitle)}
          </p>

          {hasError && (
            <p className="dial-tiny-text text-error" aria-live="polite">
              {t(ConversationInputI18nKeys.Error)}
            </p>
          )}

          <LimitsTab limits={limits} />
        </div>
      )}
    </div>
  );
};

export default memo(UsageLimitsControl);
