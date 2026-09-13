import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconEye } from '@tabler/icons-react';
import type { FC } from 'react';
import type { SkillInfoTooltipContentProps } from '../../models/skill-info-tooltip-content-props';

/** Inner content of a skill's interactive tooltip: the description above a "View details" link action. */
export const SkillInfoTooltipContent: FC<SkillInfoTooltipContentProps> = ({
  description,
  isDescriptionLoading,
  viewDetailsLabel = 'View details',
  onViewDetails,
}) => {
  const hasDescription = description != null && description !== '';

  return (
    <div className="flex flex-col gap-3">
      {isDescriptionLoading && <Spinner size={DIAL_ICON_SIZE.SM} />}
      {!isDescriptionLoading && hasDescription && (
        <p className="text-start">{description}</p>
      )}
      {/*
       * The action is reachable regardless of the description's state —
       * loading, resolved, or absent. `self-start` keeps the button at the
       * content's start edge instead of stretching it across the panel;
       * `h-[24px]` caps the kit Standard button's 40px height to the design's
       * 24px (the Standard label class `dial-small-paragraph-semi-text`,
       * 14px/24px semibold, already matches the design spec — the kit's
       * `ElementSize.Small` is not used because it swaps the label to 12px
       * tiny typography).
       */}
      <Button
        variant={ButtonVariant.Primary}
        appearance={ButtonAppearance.Link}
        className="h-[24px] self-start"
        label={viewDetailsLabel}
        iconBefore={
          <IconEye
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        }
        onClick={onViewDetails}
      />
    </div>
  );
};
