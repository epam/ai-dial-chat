import { buildCssVars } from '@epam/ai-dial-chat-shared';
import {
  GhostButton,
  NeutralButton,
  PrimaryButton,
  mergeClasses,
} from '@epam/ai-dial-ui-kit';
import {
  arrow,
  autoUpdate,
  FloatingArrow,
  FloatingFocusManager,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
} from '@floating-ui/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import {
  ARROW_HEIGHT,
  ARROW_WIDTH,
  SPOTLIGHT_PADDING,
} from '../../constants/layout';
import { ONBOARDING_TOUR_CLASS } from '../../constants/public-class-names';
import { useResolvedTarget } from '../../hooks/useResolvedTarget/useResolvedTarget';
import type { OnboardingTourProps } from '../../models/onboarding-tour';
import type { TargetRect } from '../../models/target-rect';
import { OnboardingTourEndReason } from '../../types/onboarding-tour-end-reason';
import { cardColorVars } from '../../utils/card-colors';
import {
  hintCardMiddleware,
  TARGET_RECT_MIDDLEWARE,
  targetRect,
} from '../../utils/floating';
import { spotlightRadius } from '../../utils/spotlight';
import { HintCard } from '../HintCard/HintCard';
import styles from './OnboardingTour.module.scss';

/** The events floating UI and other dismiss logic treat as an outside press; never `click`, which the card's buttons need. */
const OUTSIDE_PRESS_EVENTS = [
  'pointerdown',
  'mousedown',
  'touchstart',
] as const;

const defaultStepCounter = (current: number, total: number) =>
  `Step ${current} of ${total}`;

/** Dims the page around each step's element and walks through the steps one hint card at a time, the card pointing at the element; the page stays usable while a card is open. */
export const OnboardingTour: FC<OnboardingTourProps> = ({
  steps,
  onFinish,
  onStepComplete,
  completedStepCount = 0,
  isMobile = false,
  dir,
  labels,
  colors,
  counterClassName = 'dial-tiny-text',
  titleClassName = 'dial-body-semi-text',
  descriptionClassName = 'dial-small-paragraph-text',
  className,
}) => {
  const [index, setIndex] = useState(0);
  const [trackedSteps, setTrackedSteps] = useState(steps);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /* A new list of steps restarts the tour from its first step. */
  if (trackedSteps !== steps) {
    setTrackedSteps(steps);
    setIndex(0);
  }

  const step = steps[index] ?? null;
  const isOpen = step != null;
  const target = useResolvedTarget(step?.getTarget);
  const arrowRef = useRef<SVGSVGElement>(null);
  /* The cut-out follows the target's own corners: round for a round button, square for a panel. */
  const borderRadius = useMemo(
    () => (target ? spotlightRadius(target, SPOTLIGHT_PADDING) : undefined),
    [target],
  );

  /* Remember where focus was each time a tour opens, to give it back when
   * that tour ends; a later tour must not return to an element saved before
   * an earlier one, which is usually gone with its page. */
  useLayoutEffect(() => {
    if (isOpen) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    }
  }, [isOpen]);

  /* Only steps that were on screen count as shown; a step skipped because its
   * element was gone stays unseen for a page that renders it. */
  const shownIdsRef = useRef<Set<string>>(new Set());
  useLayoutEffect(() => {
    shownIdsRef.current = new Set();
  }, [steps]);
  useLayoutEffect(() => {
    /* The step's own lookup: `target` still holds the previous step's
     * element for the render in which the step changes. */
    if (step && target && step.getTarget()) {
      shownIdsRef.current.add(step.id);
    }
  }, [step, target]);

  const finishWith = useCallback(
    (reason: OnboardingTourEndReason) => {
      onFinish([...shownIdsRef.current], reason);
    },
    [onFinish],
  );
  const finish = useCallback(
    () => finishWith(OnboardingTourEndReason.Done),
    [finishWith],
  );
  const close = useCallback(
    () => finishWith(OnboardingTourEndReason.Closed),
    [finishWith],
  );
  const skip = useCallback(
    () => finishWith(OnboardingTourEndReason.Skipped),
    [finishWith],
  );

  const { refs, floatingStyles, context, middlewareData, isPositioned } =
    useFloating({
      open: isOpen,
      onOpenChange: (open) => {
        if (!open) {
          close();
        }
      },
      elements: { reference: target },
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [
        ...hintCardMiddleware(ARROW_HEIGHT),
        /* Kept clear of the card's rounded corners. */
        arrow({ element: arrowRef, padding: 12 }),
        targetRect(),
      ],
      whileElementsMounted: autoUpdate,
    });
  /* Escape ends the tour; a click elsewhere on the page leaves the card
   * open, so a stray tap cannot dismiss a hint the user has not read. */
  const dismissInteraction = useDismiss(context, { outsidePress: false });
  const { getFloatingProps } = useInteractions([dismissInteraction]);
  const cardRefs = useMergeRefs([refs.setFloating, cardRef]);

  /* A step whose target is not on screen when it opens is skipped. */
  useLayoutEffect(() => {
    if (!step || step.getTarget()) {
      return;
    }
    if (index < steps.length - 1) {
      setIndex(index + 1);
    } else {
      finish();
    }
  }, [step, index, steps.length, finish]);

  useLayoutEffect(() => {
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [target]);

  /* The card is portaled outside any open drawer or popover, so a press on it
   * would count as an outside press and close what the hint points at. */
  useEffect(() => {
    if (!step) {
      return undefined;
    }
    const stopOutsidePress = (event: Event) => {
      if (
        event.target instanceof Node &&
        cardRef.current?.contains(event.target)
      ) {
        event.stopPropagation();
      }
    };
    for (const type of OUTSIDE_PRESS_EVENTS) {
      window.addEventListener(type, stopOutsidePress, true);
    }
    return () => {
      for (const type of OUTSIDE_PRESS_EVENTS) {
        window.removeEventListener(type, stopOutsidePress, true);
      }
    };
  }, [step]);

  /* Each step moves focus to its card so the new title is announced. */
  useEffect(() => {
    if (step) {
      cardRef.current?.focus();
    }
  }, [step]);

  const handleBack = useCallback(() => setIndex((value) => value - 1), []);
  const handleNext = useCallback(() => {
    if (step) {
      onStepComplete?.(step.id);
    }
    setIndex((value) => value + 1);
  }, [step, onStepComplete]);

  if (!step) {
    return null;
  }

  const total = completedStepCount + steps.length;
  const isLast = index === steps.length - 1;
  const stepCounter = labels?.stepCounter ?? defaultStepCounter;

  /* Without a target to sit next to (on mobile, or while a target is briefly
   * gone) the card is a sheet. */
  const isSheet = isMobile || !target;
  const rect = target
    ? (middlewareData[TARGET_RECT_MIDDLEWARE] as TargetRect | undefined)
    : undefined;
  /* A sheet docks at the edge away from its target, so it never covers the
   * element it explains (the composer sits at the bottom on a phone). */
  const isTargetLow =
    rect != null && rect.top + rect.height / 2 > window.innerHeight / 2;

  const cssVars = buildCssVars({
    ...cardColorVars(colors),
    '--ot-backdrop': colors?.backdrop,
    '--ot-counter-text': colors?.counterText,
    '--ot-spotlight-ring': colors?.spotlightRing,
  });

  return (
    <FloatingPortal>
      <div
        dir={dir}
        style={cssVars}
        className={mergeClasses(
          ONBOARDING_TOUR_CLASS.root,
          /* The layer passes clicks through; only the card takes them. */
          'pointer-events-none fixed inset-0 z-60',
          className,
        )}
      >
        {/* Visual only: like the layer, it lets clicks through to the page.
         * With a target, the dimming is a huge shadow around a cut-out over
         * the element, so the element stays lit. */}
        {rect ? (
          <div
            aria-hidden
            className={mergeClasses(styles.cutout, 'absolute')}
            style={{
              top: rect.top - SPOTLIGHT_PADDING,
              left: rect.left - SPOTLIGHT_PADDING,
              width: rect.width + SPOTLIGHT_PADDING * 2,
              height: rect.height + SPOTLIGHT_PADDING * 2,
              borderRadius,
            }}
          />
        ) : (
          <div
            aria-hidden
            className={mergeClasses(styles.backdrop, 'absolute inset-0')}
          />
        )}
        <FloatingFocusManager
          context={context}
          modal={false}
          closeOnFocusOut={false}
          initialFocus={cardRef}
          returnFocus={returnFocusRef}
        >
          <HintCard
            {...getFloatingProps()}
            ref={cardRefs}
            heading={step.title}
            description={step.description}
            counter={stepCounter(completedStepCount + index + 1, total)}
            closeLabel={labels?.close ?? 'Close tour'}
            onClose={close}
            counterClassName={counterClassName}
            titleClassName={titleClassName}
            descriptionClassName={descriptionClassName}
            className={mergeClasses(
              'pointer-events-auto',
              isSheet && isTargetLow && 'fixed inset-x-4 top-4',
              isSheet && !isTargetLow && 'fixed inset-x-4 bottom-4',
              !isSheet && 'w-90 max-w-[calc(100vw-32px)]',
              !isSheet && !isPositioned && 'invisible',
            )}
            style={isSheet ? undefined : floatingStyles}
            arrow={
              isSheet ? undefined : (
                <FloatingArrow
                  ref={arrowRef}
                  context={context}
                  width={ARROW_WIDTH}
                  height={ARROW_HEIGHT}
                  className={styles.arrow}
                />
              )
            }
            footer={
              <div className="flex items-center justify-between gap-2">
                {/* On every step, the last one too: Done marks the shown
                 * hints seen, Skip opts out of the ones still to come. */}
                <GhostButton
                  label={labels?.skip ?? 'Skip tour'}
                  onClick={skip}
                />
                <div className="flex items-center gap-2">
                  {index > 0 && (
                    <NeutralButton
                      label={labels?.back ?? 'Back'}
                      onClick={handleBack}
                    />
                  )}
                  <PrimaryButton
                    label={
                      isLast
                        ? (labels?.done ?? 'Done')
                        : (labels?.next ?? 'Next')
                    }
                    onClick={isLast ? finish : handleNext}
                  />
                </div>
              </div>
            }
          />
        </FloatingFocusManager>
      </div>
    </FloatingPortal>
  );
};
