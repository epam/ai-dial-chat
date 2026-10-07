import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { InteractiveTooltip, TooltipPlacement } from '@epam/ai-dial-ui-kit';
import {
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
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
  unresolvedReason,
  labelClassName = 'dial-body-paragraph-text text-accent',
  unsupportedLabelClassName = 'text-error',
  unsupportedClassName = 'bg-error',
  detailsTrigger = 'hover',
  onViewDetails,
  labels = {},
}) => {
  const {
    viewDetailsLabel = 'View details',
    unsupportedTooltipLabel = 'Selected model does not support skills. Remove the skill or select different model to proceed.',
    deletedTooltipLabel = 'This skill has been deleted. Its details are no longer available.',
    notSharedTooltipLabel = "You don't have access to this skill, so its details aren't shown. Ask the chat owner to share it with you.",
  } = labels;

  /*
   * Hover mode leaves the tooltip uncontrolled. Click mode supplies its open
   * state, disabling the kit's hover/focus triggers while retaining dismissal.
   * A "View details" click remounts the card in its closed state.
   */
  const [tooltipGeneration, setTooltipGeneration] = useState(0);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const isClickTriggered = detailsTrigger === 'click';

  const handleViewDetails = () => {
    setIsTooltipOpen(false);
    setTooltipGeneration((generation) => generation + 1);
    onViewDetails(path);
  };

  const openTooltipOnKeyboardActivation = (event: KeyboardEvent) => {
    if (!isClickTriggered || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    setIsTooltipOpen(true);
  };

  /*
   * `/` is rendered out-of-flow so it can be styled independently; the
   * measured width becomes the label's start padding, keeping the chip's
   * total width equal to the invisible `/{name}` text it overlays. See
   * `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3a (multi-skill-message-mentions).
   */
  const slashRef = useRef<HTMLSpanElement | null>(null);
  const [slashWidth, setSlashWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    setSlashWidth(slashRef.current?.getBoundingClientRect().width ?? null);
  }, [labelClassName]);

  /*
   * Branch order matches `openspec/changes/archive/2026-09-29-add-unresolved-skill-indicator/design.md` Decision 1: an unresolved url takes
   * precedence over the unsupported-model state, which takes precedence
   * over the normal description + "View details" content.
   */
  const renderTooltipContent = () => {
    if (unresolvedReason != null) {
      return (
        <SkillInfoTooltipContent
          unresolvedReason={unresolvedReason}
          deletedMessage={deletedTooltipLabel}
          notSharedMessage={notSharedTooltipLabel}
        />
      );
    }

    if (isUnsupported) {
      return (
        <SkillInfoTooltipContent unsupportedMessage={unsupportedTooltipLabel} />
      );
    }

    return (
      <SkillInfoTooltipContent
        description={description}
        viewDetailsLabel={viewDetailsLabel}
        onViewDetails={handleViewDetails}
      />
    );
  };

  return (
    <InteractiveTooltip
      key={tooltipGeneration}
      asChild
      placement={TooltipPlacement.Top}
      open={isClickTriggered ? isTooltipOpen : undefined}
      onOpenChange={isClickTriggered ? setIsTooltipOpen : undefined}
      contentClassName="max-w-[550px]"
      content={renderTooltipContent()}
    >
      {/*
       * Plain, selectable text span, not a `<button>` — sized to net-zero
       * extra width so the composer mirror can overlay it on the real
       * textarea text. See `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3a (multi-skill-message-mentions)
       * for the full rationale. `inline`, not `inline-block`: the textarea
       * may break the raw `/{name}` after any hyphen, and an atomic chip
       * cannot, so the mirror would wrap onto an extra line the textarea
       * never grows to show ([#9243](https://github.com/epam/ai-dial-chat/issues/9243)).
       */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- click/keydown only act in click-triggered mode; hover mode's tooltip is reachable via focus alone */}
      <span
        tabIndex={0}
        className={mergeClasses(
          'relative -me-1 -ms-1 inline cursor-pointer select-text rounded-full pe-1 ps-1',
          isUnsupported
            ? unsupportedClassName
            : 'hover:bg-info focus-visible:bg-info active:bg-info',
          isUnsupported
            ? mergeClasses(labelClassName, unsupportedLabelClassName)
            : labelClassName,
          SKILLS_CLASS.chip,
        )}
        aria-label={`/${name}`}
        onClick={isClickTriggered ? () => setIsTooltipOpen(true) : undefined}
        onKeyDown={openTooltipOnKeyboardActivation}
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
