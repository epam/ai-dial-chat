import { buildCssVars } from '@epam/ai-dial-chat-shared';
import {
  GhostButton,
  NeutralButton,
  PrimaryButton,
  mergeClasses,
} from '@epam/ai-dial-ui-kit';
import {
  autoUpdate,
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
  useRef,
  useState,
  type FC,
} from 'react';
import { ONBOARDING_TOUR_CLASS } from '../../constants/public-class-names';
import { useResolvedTarget } from '../../hooks/useResolvedTarget/useResolvedTarget';
import type { OnboardingTourProps } from '../../models/onboarding-tour';
import { cardColorVars } from '../../utils/card-colors';
import { hintCardMiddleware } from '../../utils/floating';
import { HintCard } from '../HintCard/HintCard';

const defaultStepCounter = (current: number, total: number) =>
  `Step ${current} of ${total}`;

/** Walks through the steps one hint card at a time, each card next to its step's element; the page stays usable while a card is open. */
export const OnboardingTour: FC<OnboardingTourProps> = ({
  steps,
  onFinish,
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

  /* Remember where focus was before the tour took it, to give it back. */
  useLayoutEffect(() => {
    if (isOpen && returnFocusRef.current == null) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    }
  }, [isOpen]);

  const finish = useCallback(() => {
    onFinish(steps.map(({ id }) => id));
  }, [onFinish, steps]);

  const { refs, floatingStyles, context, isPositioned } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        finish();
      }
    },
    elements: { reference: target },
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: hintCardMiddleware(),
    whileElementsMounted: autoUpdate,
  });
  /* Escape ends the tour; a click elsewhere on the page leaves the card
   * open, so a stray tap cannot dismiss a hint the user has not read. */
  const dismiss = useDismiss(context, { outsidePress: false });
  const { getFloatingProps } = useInteractions([dismiss]);
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

  /* Each step moves focus to its card so the new title is announced. */
  useEffect(() => {
    if (step) {
      cardRef.current?.focus();
    }
  }, [step]);

  const handleBack = useCallback(() => setIndex((value) => value - 1), []);
  const handleNext = useCallback(() => setIndex((value) => value + 1), []);

  if (!step) {
    return null;
  }

  const total = steps.length;
  const isLast = index === total - 1;
  const stepCounter = labels?.stepCounter ?? defaultStepCounter;

  /* Without a target to sit next to (on mobile, or while a target is briefly
   * gone) the card is a bottom sheet. */
  const isSheet = isMobile || !target;

  const cssVars = buildCssVars({
    ...cardColorVars(colors),
    '--ot-counter-text': colors?.counterText,
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
            counter={stepCounter(index + 1, total)}
            closeLabel={labels?.close ?? 'Close tour'}
            onClose={finish}
            counterClassName={counterClassName}
            titleClassName={titleClassName}
            descriptionClassName={descriptionClassName}
            className={mergeClasses(
              'pointer-events-auto',
              isSheet
                ? 'fixed inset-x-4 bottom-4'
                : 'w-90 max-w-[calc(100vw-32px)]',
              !isSheet && !isPositioned && 'invisible',
            )}
            style={isSheet ? undefined : floatingStyles}
            footer={
              <div className="flex items-center justify-between gap-2">
                {isLast ? (
                  <span />
                ) : (
                  <GhostButton
                    label={labels?.skip ?? 'Skip tour'}
                    onClick={finish}
                  />
                )}
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
