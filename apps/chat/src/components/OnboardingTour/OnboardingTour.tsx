import type { OnboardingHintDto } from '@epam/ai-dial-chat-api-client';
import { mergeClasses, useIsMobile } from '@epam/ai-dial-chat-shared';
import {
  CloseButton,
  ElementSize,
  GhostButton,
  NeutralButton,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  NavigationI18nKeys,
  OnboardingTourI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { StorageKey } from '../../types/storage-key';
import { UserConfigStatus } from '../../types/user-config-status';
import { computeCardPosition, type Box } from './card-position';
import {
  resolveOnboardingTarget,
  type OnboardingTargetLabels,
} from './onboarding-targets';

/* Lets a route render before targets are looked up. */
export const ONBOARDING_START_DELAY_MS = 800;
/* Then keeps looking for about ten seconds while the page loads its data. */
export const ONBOARDING_RETRY_INTERVAL_MS = 500;
const ONBOARDING_RETRY_ATTEMPTS = 20;
const SPOTLIGHT_PADDING = 6;

const toBox = (element: HTMLElement): Box => {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const isSameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (a != null &&
    b != null &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height);

/**
 * First-visit onboarding: walks the user through the operator-configured
 * `onboardingHints` one at a time, dimming the page and spotlighting each
 * hint's element. Hints whose element is not on screen are skipped. Finishing
 * or skipping the tour stores the shown ids in `localStorage`, so a hint is
 * seen once per browser and a new id is shown on the next visit.
 *
 * Prototype: lives in the app because target resolution and persistence are
 * host concerns; the rendering half is a candidate for a lib once the design
 * settles.
 */
const OnboardingTour: FC = () => {
  const { t, i18n } = useTranslation();
  const { status, config } = useAppConfig();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const [seenIds, setSeenIds] = useLocalStorage<string[]>(
    StorageKey.SeenOnboardingHints,
    [],
  );
  const [steps, setSteps] = useState<OnboardingHintDto[] | null>(null);
  const [index, setIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<Box | null>(null);
  const [cardPosition, setCardPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const isRtl = i18n.dir() === 'rtl';
  /* Keyed on the strings, not on `t`, so the effects below rerun only when
   * the language actually changes. */
  const labelsKey = JSON.stringify({
    newChat: t(ButtonsI18nKeys.NewChat),
    navigation: t(NavigationI18nKeys.AriaLabel),
    projects: t(NavigationI18nKeys.Projects),
    scheduledTasks: t(NavigationI18nKeys.ScheduledTasks),
    catalog: t(NavigationI18nKeys.Catalog),
    fileManager: t(NavigationI18nKeys.FileManager),
    addAttachment: t(ButtonsI18nKeys.Add),
    catalogCreate: t(ButtonsI18nKeys.Create),
    catalogViewMode: t(CatalogI18nKeys.ViewToggleLabel),
  } satisfies OnboardingTargetLabels);
  const labels = useMemo(
    () => JSON.parse(labelsKey) as OnboardingTargetLabels,
    [labelsKey],
  );

  const pendingHints = useMemo(
    () => config.onboardingHints.filter((hint) => !seenIds.includes(hint.id)),
    [config.onboardingHints, seenIds],
  );

  /* Look for unseen hints on every route, after the route had a moment to
   * paint, and keep looking for a while: a page such as the catalog renders
   * its controls only once its data arrives. The tour shows the hints that
   * are on screen; the rest stay unseen until a page renders them, so a
   * catalog hint waits for the first visit to the catalog. */
  const isRunning = steps != null;
  useEffect(() => {
    if (
      isRunning ||
      status !== UserConfigStatus.Ready ||
      pendingHints.length === 0
    ) {
      return;
    }
    let attempts = 0;
    let timer = 0;
    const tryStart = () => {
      const visible = pendingHints.filter(
        (hint) => resolveOnboardingTarget(hint.target, labels) != null,
      );
      if (visible.length > 0) {
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        setSteps(visible);
        setIndex(0);
        return;
      }
      attempts += 1;
      if (attempts < ONBOARDING_RETRY_ATTEMPTS) {
        timer = window.setTimeout(tryStart, ONBOARDING_RETRY_INTERVAL_MS);
      }
    };
    timer = window.setTimeout(tryStart, ONBOARDING_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isRunning, status, pendingHints, labels, pathname]);

  const step = steps?.[index] ?? null;

  const finish = useCallback(() => {
    if (steps) {
      const shown = steps.map((hint) => hint.id);
      setSeenIds([...seenIds.filter((id) => !shown.includes(id)), ...shown]);
    }
    setSteps(null);
    setTargetBox(null);
    returnFocusRef.current?.focus?.();
  }, [steps, seenIds, setSeenIds]);

  /* Track the target's box while a step is open: layout shifts, scrolling and
   * resizes all move it. A target that vanished mid-tour is skipped. */
  useLayoutEffect(() => {
    if (!step || !steps) {
      return;
    }
    let element = resolveOnboardingTarget(step.target, labels);
    if (!element) {
      if (index < steps.length - 1) {
        setIndex(index + 1);
      } else {
        finish();
      }
      return;
    }
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element = resolveOnboardingTarget(step.target, labels) ?? element;
        if (element) {
          const next = toBox(element);
          setTargetBox((previous) =>
            isSameBox(previous, next) ? previous : next,
          );
        }
      });
    };
    const initial = toBox(element);
    setTargetBox((previous) =>
      isSameBox(previous, initial) ? previous : initial,
    );

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    observer?.observe(document.body);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, steps, index, labels, finish]);

  /* Place the card once both boxes are known; on mobile it is a bottom sheet. */
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!targetBox || !card || isMobile) {
      setCardPosition(null);
      return;
    }
    const next = computeCardPosition(
      targetBox,
      { width: card.offsetWidth, height: card.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      isRtl,
    );
    setCardPosition((previous) =>
      previous?.top === next.top && previous.left === next.left
        ? previous
        : next,
    );
  }, [targetBox, isMobile, isRtl, index]);

  /* Each step moves focus to its card so the new title is announced. */
  useEffect(() => {
    if (step) {
      cardRef.current?.focus();
    }
  }, [step]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) {
        return;
      }
      /* Keep Tab inside the card: the page behind is dimmed and blocked. */
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === cardRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    },
    [finish],
  );

  if (!steps || !step) {
    return null;
  }

  const isLast = index === steps.length - 1;
  const total = steps.length;

  return createPortal(
    <div className="fixed inset-0 z-60">
      {/* Blocks the page behind the tour; a click on it does nothing, so a
          stray tap cannot dismiss a hint the user has not read. */}
      <div className="absolute inset-0" aria-hidden />
      {targetBox ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg border-2 border-accent motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: targetBox.top - SPOTLIGHT_PADDING,
            left: targetBox.left - SPOTLIGHT_PADDING,
            width: targetBox.width + SPOTLIGHT_PADDING * 2,
            height: targetBox.height + SPOTLIGHT_PADDING * 2,
            /* The theme's raw backdrop token: Tailwind does not emit its own
             * --background-color-* variables for an inline style to read. */
            boxShadow: '0 0 0 9999px var(--bg-backdrop, #161b2d4d)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-backdrop" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={step.description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={mergeClasses(
          'absolute flex flex-col gap-3 rounded-lg border border-tertiary bg-layer-raised p-4 shadow-lg outline-none',
          isMobile
            ? 'inset-x-4 bottom-4'
            : 'w-[360px] max-w-[calc(100vw-32px)]',
          !isMobile && !cardPosition && 'invisible',
        )}
        style={
          !isMobile && cardPosition
            ? { top: cardPosition.top, left: cardPosition.left }
            : undefined
        }
      >
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="dial-tiny-text text-tertiary">
              {t(OnboardingTourI18nKeys.StepCounter, {
                current: index + 1,
                total,
              })}
            </span>
            <h2 id={titleId} className="dial-body-semi-text text-primary">
              {step.title}
            </h2>
          </div>
          <CloseButton
            ariaLabel={t(OnboardingTourI18nKeys.Close)}
            size={ElementSize.Standard}
            onClose={finish}
          />
        </div>
        {step.description && (
          <p
            id={descriptionId}
            className="dial-small-paragraph-text text-secondary"
          >
            {step.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {isLast ? (
            <span />
          ) : (
            <GhostButton
              label={t(OnboardingTourI18nKeys.Skip)}
              onClick={finish}
            />
          )}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <NeutralButton
                label={t(OnboardingTourI18nKeys.Back)}
                onClick={() => setIndex(index - 1)}
              />
            )}
            <PrimaryButton
              label={t(
                isLast
                  ? OnboardingTourI18nKeys.Done
                  : OnboardingTourI18nKeys.Next,
              )}
              onClick={isLast ? finish : () => setIndex(index + 1)}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default memo(OnboardingTour);
