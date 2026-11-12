import { buildCssVars } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-ui-kit';
import { FloatingPortal } from '@floating-ui/react';
import { useCallback, useState, type FC } from 'react';
import { ONBOARDING_BEACONS_CLASS } from '../../constants/public-class-names';
import type { OnboardingBeaconsProps } from '../../models/onboarding-tour';
import { cardColorVars } from '../../utils/card-colors';
import { OnboardingBeacon } from '../OnboardingBeacon/OnboardingBeacon';

const defaultBeaconLabel = (title: string) => `Show hint: ${title}`;

/** Marks each hint's element with a beacon that opens the hint's card on demand. */
export const OnboardingBeacons: FC<OnboardingBeaconsProps> = ({
  hints,
  onDismiss,
  dir,
  labels,
  colors,
  titleClassName = 'dial-body-semi-text',
  descriptionClassName = 'dial-small-paragraph-text',
  className,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggle = useCallback(
    (id: string) => setOpenId((current) => (current === id ? null : id)),
    [],
  );
  const handleClose = useCallback(() => setOpenId(null), []);
  const handleDismiss = useCallback(
    (id: string) => {
      setOpenId(null);
      onDismiss(id);
    },
    [onDismiss],
  );

  if (hints.length === 0) {
    return null;
  }

  const beaconLabel = labels?.beacon ?? defaultBeaconLabel;
  const cssVars = buildCssVars({
    ...cardColorVars(colors),
    '--ob-beacon': colors?.beacon,
    '--ob-beacon-ring': colors?.beaconRing,
    '--ob-focus': colors?.beaconFocusOutline,
  });

  return (
    <FloatingPortal>
      <div
        dir={dir}
        style={cssVars}
        className={mergeClasses(ONBOARDING_BEACONS_CLASS.root, className)}
      >
        {hints.map((hint) => (
          <OnboardingBeacon
            key={hint.id}
            hint={hint}
            isOpen={openId === hint.id}
            onToggle={handleToggle}
            onClose={handleClose}
            onDismiss={handleDismiss}
            beaconLabel={beaconLabel(hint.title)}
            gotItLabel={labels?.gotIt ?? 'Got it'}
            titleClassName={titleClassName}
            descriptionClassName={descriptionClassName}
          />
        ))}
      </div>
    </FloatingPortal>
  );
};
