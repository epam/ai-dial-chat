import { mergeClasses } from '@epam/ai-dial-ui-kit';
import { autoUpdate, hide, useFloating } from '@floating-ui/react';
import { useEffect, useMemo, type FC } from 'react';
import { ONBOARDING_ANCHOR_MAP_CLASS } from '../../constants/public-class-names';
import { useResolvedTarget } from '../../hooks/useResolvedTarget/useResolvedTarget';
import type { OnboardingAnchor } from '../../models/onboarding-tour';
import type { TargetRect } from '../../models/target-rect';
import { TARGET_RECT_MIDDLEWARE, targetRect } from '../../utils/floating';
import { spotlightRadius } from '../../utils/spotlight';
import styles from './AnchorOutline.module.scss';

/** Props for the internal `AnchorOutline` component. */
interface AnchorOutlineProps {
  /** The anchor to outline. */
  anchor: OnboardingAnchor;
  /** Called with whether the anchor's element is on screen, whenever that changes. */
  onAvailabilityChange: (id: string, isOnScreen: boolean) => void;
  /** Typography class of the name tag. */
  tagClassName: string;
}

/** A dashed outline around one anchor's element with the anchor's name above it. */
export const AnchorOutline: FC<AnchorOutlineProps> = ({
  anchor,
  onAvailabilityChange,
  tagClassName,
}) => {
  const target = useResolvedTarget(anchor.getTarget);
  const isOnScreen = target != null;

  useEffect(() => {
    onAvailabilityChange(anchor.id, isOnScreen);
  }, [anchor.id, isOnScreen, onAvailabilityChange]);

  /* The tag is the floating element; the outline reuses the reference box. */
  const { refs, floatingStyles, middlewareData, isPositioned } = useFloating({
    elements: { reference: target },
    strategy: 'fixed',
    placement: 'top-start',
    middleware: [targetRect(), hide()],
    whileElementsMounted: autoUpdate,
  });
  const borderRadius = useMemo(
    () => (target ? spotlightRadius(target, 0) : undefined),
    [target],
  );

  if (!target) {
    return null;
  }

  const rect = middlewareData[TARGET_RECT_MIDDLEWARE] as TargetRect | undefined;
  const isHidden = !isPositioned || middlewareData.hide?.referenceHidden;

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className={mergeClasses(
            ONBOARDING_ANCHOR_MAP_CLASS.outline,
            styles.outline,
            'fixed border-2 border-dashed',
            isHidden && 'invisible',
          )}
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius,
          }}
        />
      )}
      <span
        ref={refs.setFloating}
        style={floatingStyles}
        className={mergeClasses(
          ONBOARDING_ANCHOR_MAP_CLASS.tag,
          styles.tag,
          'rounded px-1 whitespace-nowrap',
          tagClassName,
          isHidden && 'invisible',
        )}
      >
        {anchor.id}
      </span>
    </>
  );
};
