import {
  GhostButton,
  InteractiveTooltip,
  TooltipPlacement,
} from '@epam/ai-dial-ui-kit';
import { useState, type FC } from 'react';
import type { ChatSkillProps } from '../../models/chat-skill-props';
import { SkillInfoTooltipContent } from '../SkillInfoTooltipContent/SkillInfoTooltipContent';

/** A used skill rendered as a `/name` ghost button with a description tooltip and a "View details" action. */
export const ChatSkill: FC<ChatSkillProps> = ({
  name,
  path,
  description,
  isDescriptionLoading,
  labelClassName = 'dial-body-paragraph-text',
  onViewDetails,
  onTooltipOpen,
  labels = {},
}) => {
  const { viewDetailsLabel = 'View details' } = labels;

  /*
   * The tooltip is uncontrolled (the kit opens it on hover/focus) and exposes
   * no imperative close, so a "View details" click remounts it — the fresh
   * instance's open state starts closed. This mirrors the favorites rows,
   * whose tooltip unmounts with the Add menu on the same click; reopening
   * takes a fresh hover or focus, not the pointer already resting on the chip.
   */
  const [tooltipGeneration, setTooltipGeneration] = useState(0);

  const handleViewDetails = () => {
    setTooltipGeneration((generation) => generation + 1);
    onViewDetails(path);
  };

  return (
    <InteractiveTooltip
      key={tooltipGeneration}
      asChild
      placement={TooltipPlacement.Top}
      contentClassName="max-w-[550px]"
      onOpenChange={(isOpen) => {
        if (isOpen) onTooltipOpen?.(path);
      }}
      content={
        <SkillInfoTooltipContent
          description={description}
          isDescriptionLoading={isDescriptionLoading}
          viewDetailsLabel={viewDetailsLabel}
          onViewDetails={handleViewDetails}
        />
      }
    >
      {/*
       * The span is the tooltip's trigger (`asChild`), so the tooltip stays
       * open while the pointer moves between it and the button. The button
       * body is presentation only — activating it does nothing beyond opening
       * the tooltip; removal is the host input's Backspace-at-start gesture.
       */}
      <span className="inline-flex items-center">
        {/*
         * `h-auto px-2 py-0` overrides the kit button's `h-[40px] px-4` so
         * the chip is exactly its label line (26px with the default
         * `dial-body-paragraph-text` label) plus 8px of horizontal padding —
         * no vertical padding, so the total height stays at the label line's
         * height and the chip's text aligns with the input's first text line.
         */}
        <GhostButton
          label={`/${name}`}
          textClassName={labelClassName}
          className="h-auto px-2 py-0"
        />
      </span>
    </InteractiveTooltip>
  );
};
