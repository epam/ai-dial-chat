import { PrimaryButton, mergeClasses } from '@epam/ai-dial-ui-kit';
import {
  autoUpdate,
  FloatingFocusManager,
  hide,
  offset,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
} from '@floating-ui/react';
import { useId, useRef, type FC } from 'react';
import { BEACON_SIZE } from '../../constants/layout';
import { ONBOARDING_BEACONS_CLASS } from '../../constants/public-class-names';
import { useResolvedTarget } from '../../hooks/useResolvedTarget/useResolvedTarget';
import type { OnboardingTourStep } from '../../models/onboarding-tour';
import { hintCardMiddleware } from '../../utils/floating';
import { HintCard } from '../HintCard/HintCard';
import styles from './OnboardingBeacon.module.scss';

/** Props for the internal `OnboardingBeacon` component. */
interface OnboardingBeaconProps {
  /** The hint this beacon marks. */
  hint: OnboardingTourStep;
  /** Whether this beacon's card is open. */
  isOpen: boolean;
  /** Called when the beacon is pressed. */
  onToggle: (id: string) => void;
  /** Called when the card closes without dismissing the hint. */
  onClose: () => void;
  /** Called when the hint is dismissed with Got it. */
  onDismiss: (id: string) => void;
  /** Accessible label of the beacon. */
  beaconLabel: string;
  /** Label of the Got it button. */
  gotItLabel: string;
  /** Typography class of the card title. */
  titleClassName: string;
  /** Typography class of the card description. */
  descriptionClassName: string;
}

/** A pulsing dot at the corner of a hint's target that opens the hint's card. */
export const OnboardingBeacon: FC<OnboardingBeaconProps> = ({
  hint,
  isOpen,
  onToggle,
  onClose,
  onDismiss,
  beaconLabel,
  gotItLabel,
  titleClassName,
  descriptionClassName,
}) => {
  const target = useResolvedTarget(hint.getTarget);
  const beaconRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = useId();

  /* The dot's centre sits on the target's top end corner. */
  const beacon = useFloating({
    elements: { reference: target },
    strategy: 'fixed',
    placement: 'top-end',
    middleware: [
      offset({ mainAxis: -BEACON_SIZE / 2, crossAxis: BEACON_SIZE / 2 }),
      hide(),
    ],
    whileElementsMounted: autoUpdate,
  });

  const card = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
    elements: { reference: target },
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: hintCardMiddleware(),
    whileElementsMounted: autoUpdate,
  });
  /* A press on the beacon toggles the card itself; it is not an outside press. */
  const dismiss = useDismiss(card.context, {
    outsidePress: (event) =>
      !(
        event.target instanceof Node &&
        beaconRef.current?.contains(event.target)
      ),
  });
  const { getFloatingProps } = useInteractions([dismiss]);

  const beaconRefs = useMergeRefs([beacon.refs.setFloating, beaconRef]);
  const cardRefs = useMergeRefs([card.refs.setFloating, cardRef]);

  if (!target) {
    return null;
  }

  const isHidden =
    !beacon.isPositioned || beacon.middlewareData.hide?.referenceHidden;

  return (
    <>
      {/* A raw button: the kit has no hotspot control. */}
      <button
        ref={beaconRefs}
        type="button"
        aria-label={beaconLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? cardId : undefined}
        onClick={() => onToggle(hint.id)}
        style={beacon.floatingStyles}
        className={mergeClasses(
          ONBOARDING_BEACONS_CLASS.beacon,
          styles.beacon,
          'z-40 flex size-6 items-center justify-center rounded-full',
          isHidden && 'invisible',
        )}
      >
        <span aria-hidden className={styles.dot} />
      </button>
      {isOpen && (
        <FloatingFocusManager
          context={card.context}
          modal={false}
          initialFocus={cardRef}
          returnFocus={beaconRef}
        >
          <HintCard
            {...getFloatingProps()}
            id={cardId}
            ref={cardRefs}
            heading={hint.title}
            description={hint.description}
            titleClassName={titleClassName}
            descriptionClassName={descriptionClassName}
            style={card.floatingStyles}
            className={mergeClasses(
              'z-50 w-80 max-w-[calc(100vw-32px)]',
              !card.isPositioned && 'invisible',
            )}
            footer={
              <div className="flex justify-end">
                <PrimaryButton
                  label={gotItLabel}
                  onClick={() => onDismiss(hint.id)}
                />
              </div>
            }
          />
        </FloatingFocusManager>
      )}
    </>
  );
};
