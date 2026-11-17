import { useMemo, type FC } from 'react';
import { useOnboardingHints } from '../../hooks/useOnboardingHints/useOnboardingHints';
import type {
  OnboardingAnchor,
  OnboardingHintsProps,
} from '../../models/onboarding-tour';
import { OnboardingAnchorMap } from '../OnboardingAnchorMap/OnboardingAnchorMap';
import { OnboardingTour } from '../OnboardingTour/OnboardingTour';

/** Shows the unseen hints whose element is on the page as a tour, or outlines every anchor instead while `isAnchorView` is set. */
export const OnboardingHints: FC<OnboardingHintsProps> = ({
  anchorTargets,
  isAnchorView = false,
  onCloseAnchorView,
  isMobile = false,
  dir,
  labels,
  isEnabled,
  ...hintOptions
}) => {
  const { resolveTarget } = hintOptions;
  const { steps, onFinish, onStepComplete } = useOnboardingHints({
    ...hintOptions,
    isEnabled: isEnabled && !isAnchorView,
  });

  const anchors = useMemo<OnboardingAnchor[]>(
    () =>
      anchorTargets.map((target) => ({
        id: target,
        getTarget: () => resolveTarget(target),
      })),
    [anchorTargets, resolveTarget],
  );

  if (isAnchorView) {
    return (
      <OnboardingAnchorMap
        anchors={anchors}
        onClose={onCloseAnchorView ?? (() => undefined)}
        dir={dir}
        labels={labels?.anchorMap}
      />
    );
  }

  return (
    <OnboardingTour
      steps={steps}
      onFinish={onFinish}
      onStepComplete={onStepComplete}
      isMobile={isMobile}
      dir={dir}
      labels={labels?.tour}
    />
  );
};
