import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { InteractiveTooltip, TooltipPlacement } from '@epam/ai-dial-ui-kit';
import { useLayoutEffect, useRef, useState, type FC } from 'react';
import { SKILLS_CLASS } from '../../constants/public-class-names';
import type { ChatSkillProps } from '../../models/chat-skill-props';
import { SkillInfoTooltipContent } from '../SkillInfoTooltipContent/SkillInfoTooltipContent';

/**
 * A used skill rendered as a `/name` chip — plain, selectable text styled to
 * read as a button, with a description tooltip and a "View details" action,
 * or the error state while unsupported.
 */
export const ChatSkill: FC<ChatSkillProps> = ({
  name,
  path,
  description,
  isUnsupported = false,
  labelClassName = 'dial-body-paragraph-text text-accent',
  unsupportedLabelClassName = 'text-error',
  unsupportedClassName = 'bg-error',
  onViewDetails,
  labels = {},
}) => {
  const {
    viewDetailsLabel = 'View details',
    unsupportedTooltipLabel = 'Selected model does not support skills. Remove the skill or select different model to proceed.',
  } = labels;

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

  /*
   * `/` is rendered out-of-flow so it can be styled independently; the
   * measured width becomes the label's start padding, keeping the chip's
   * total width equal to the invisible `/{name}` text it overlays. See
   * design.md Decision 3a (multi-skill-message-mentions).
   */
  const slashRef = useRef<HTMLSpanElement | null>(null);
  const [slashWidth, setSlashWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    setSlashWidth(slashRef.current?.getBoundingClientRect().width ?? null);
  }, [labelClassName]);

  return (
    <InteractiveTooltip
      key={tooltipGeneration}
      asChild
      placement={TooltipPlacement.Top}
      contentClassName="max-w-[550px]"
      content={
        isUnsupported ? (
          <SkillInfoTooltipContent
            unsupportedMessage={unsupportedTooltipLabel}
          />
        ) : (
          <SkillInfoTooltipContent
            description={description}
            viewDetailsLabel={viewDetailsLabel}
            onViewDetails={handleViewDetails}
          />
        )
      }
    >
      {/*
       * Plain, selectable text span, not a `<button>` — sized to net-zero
       * extra width so the composer mirror can overlay it on the real
       * textarea text. See design.md Decision 3a (multi-skill-message-mentions)
       * for the full rationale.
       */}
      <span
        tabIndex={0}
        className={mergeClasses(
          'relative -me-1 -ms-1 inline-block cursor-pointer select-text rounded-full pe-1 ps-1',
          isUnsupported
            ? unsupportedClassName
            : 'hover:bg-info focus-visible:bg-info active:bg-info',
          isUnsupported
            ? mergeClasses(labelClassName, unsupportedLabelClassName)
            : labelClassName,
          SKILLS_CLASS.chip,
        )}
        aria-label={`/${name}`}
      >
        <span
          ref={slashRef}
          aria-hidden
          className="inset-inline-start-0 pointer-events-none absolute top-0 select-none"
        >
          /
        </span>
        <span
          aria-hidden
          className="select-none"
          style={{
            paddingInlineStart: slashWidth != null ? slashWidth : undefined,
          }}
        >
          {name}
        </span>
      </span>
    </InteractiveTooltip>
  );
};
