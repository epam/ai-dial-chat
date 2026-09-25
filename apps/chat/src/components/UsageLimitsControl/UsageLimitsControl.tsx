import {
  CatalogLimitStatus,
  LimitRowLayout,
  LimitsTab,
} from '@epam/ai-dial-catalog';
import { mapDeploymentLimitsToInput } from '@epam/ai-dial-chat-hooks';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconChevronRight } from '@tabler/icons-react';
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
import { Link } from 'react-router';
import { ConversationInputI18nKeys } from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useDeploymentUsageLimits } from '../../hooks/useDeploymentUsageLimits';
import { SettingsTabs } from '../../types/settings-tabs';
import { resolveLocalizedText } from '../../utils/locale';
import { buildSettingsTabPath } from '../../utils/routes';
import {
  findWorstCappedRow,
  getGaugeNeedleAngle,
} from '../../utils/usage-limits';
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
  const { items: deployments } = useDeployments();
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
      costGroup: t(ConversationInputI18nKeys.CostGroup),
      periodDay: t(ConversationInputI18nKeys.PeriodDay),
      periodWeek: t(ConversationInputI18nKeys.PeriodWeek),
      periodMonth: t(ConversationInputI18nKeys.PeriodMonth),
      formatValueLabel: (used: string, total: string) =>
        t(ConversationInputI18nKeys.Value, { used, total }),
      formatProgressAriaLabel: (params: {
        label: string;
        used: string;
        total: string;
      }) => t(ConversationInputI18nKeys.ProgressAriaLabel, params),
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

  /* The popover is titled with the deployment it reports on. Falls back to the
     generic string when the selection is not in the list yet. */
  const deploymentName = useMemo(() => {
    const deployment = deployments.find((item) => item.id === deploymentId);
    if (deployment == null) {
      return undefined;
    }

    return (
      resolveLocalizedText(deployment.displayName, activeLocale) ||
      deployment.id
    );
  }, [deployments, deploymentId, activeLocale]);

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
  const usedPercent = worstRow?.usedPercent ?? 0;
  const triggerValue = `${usedPercent}%`;
  const gaugeStyle = {
    '--usage-angle': getGaugeNeedleAngle(usedPercent),
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

  /* Dial face, tinted with the matching light background token so the status
     reads without relying on the needle's colour alone. */
  const getStatusFaceClass = () => {
    if (isLimitReached) return 'bg-error';
    if (isRunningLow) return 'bg-warning';
    return 'bg-info';
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
            'relative inline-block size-3.5 shrink-0 rounded-full',
            getStatusFaceClass(),
            styles.gauge,
          )}
          style={gaugeStyle}
        >
          <span className={styles.gaugeNeedle} />
        </span>
      </button>

      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="absolute bottom-full end-0 z-50 mb-2 flex w-[22.5rem] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg bg-layer-raised p-4 shadow-lg focus:outline-none"
        >
          <p id={titleId} className="dial-small-semi-text text-primary">
            {deploymentName ?? t(ConversationInputI18nKeys.PopoverTitle)}
          </p>

          {hasError && (
            <p className="dial-tiny-text text-error" aria-live="polite">
              {t(ConversationInputI18nKeys.Error)}
            </p>
          )}

          <LimitsTab
            limits={limits}
            layout={LimitRowLayout.Stacked}
            /* The popover lists only what needs attention, so this is the one
               way to the whole picture from the conversation. */
            footerClassName="dial-caption-text pt-3"
            footerNote={
              <Link
                to={buildSettingsTabPath(SettingsTabs.Usage)}
                onClick={() => setIsOpen(false)}
                /* The negative inline-start margin cancels the pill's own
                   padding so the label still lines up with the rows above. */
                className="dial-tiny-semi-text -ms-2 inline-flex h-6 items-center gap-1 rounded-full px-2 text-accent hover:bg-control-accent-alpha-hover focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus"
              >
                {t(ConversationInputI18nKeys.FullUsageLink)}
                <IconChevronRight
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                  className="rtl:scale-x-[-1]"
                />
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
};

export default memo(UsageLimitsControl);
