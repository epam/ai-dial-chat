import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconEye, IconLock, IconTrash } from '@tabler/icons-react';
import type { FC } from 'react';
import type { SkillInfoTooltipContentProps } from '../../models/skill-info-tooltip-content-props';
import { SkillUnresolvedReason } from '../../types/skill-unresolved-reason';

/** Inner content of a skill's interactive tooltip: the description above a "View details" link action, the unsupported-model message alone, or an unresolved-skill message alone. */
export const SkillInfoTooltipContent: FC<SkillInfoTooltipContentProps> = ({
  description,
  unsupportedMessage,
  unresolvedReason,
  deletedMessage,
  notSharedMessage,
  viewDetailsLabel = 'View details',
  onViewDetails,
  viewDetailsTabIndex,
  textClassName = 'dial-tiny-text',
}) => {
  /*
   * An unresolved url replaces the whole content: an icon plus a fixed
   * message, no description and no "View details" action — there is no
   * metadata to fetch and no panel to open. Takes precedence over the
   * unsupported-model state (the two never co-occur in practice, but this
   * ordering documents which wins if they somehow did).
   */
  if (unresolvedReason != null) {
    const isDeleted = unresolvedReason === SkillUnresolvedReason.Deleted;
    const Icon = isDeleted ? IconTrash : IconLock;
    const message = isDeleted ? deletedMessage : notSharedMessage;

    return (
      <div className="flex flex-row items-center gap-2">
        <Icon
          size={DIAL_ICON_SIZE.MD}
          stroke={DIAL_KIT_ICON_STROKE}
          aria-hidden
          className="shrink-0 text-secondary"
        />
        <p className={mergeClasses(textClassName, 'text-start text-primary')}>
          {message}
        </p>
      </div>
    );
  }

  /*
   * The unsupported state replaces the whole content: the message alone, no
   * description and no "View details" action — the skill cannot be sent as
   * selected, so there is nothing to open details for.
   */
  if (unsupportedMessage != null) {
    return (
      <p className={mergeClasses(textClassName, 'text-start')}>
        {unsupportedMessage}
      </p>
    );
  }

  const hasDescription = description != null && description !== '';

  return (
    <div className="flex flex-col gap-3">
      {hasDescription && (
        <p className={mergeClasses(textClassName, 'text-start')}>
          {description}
        </p>
      )}
      {/*
       * The action is reachable regardless of the description's state —
       * present or absent. `self-start` keeps the button at the
       * content's start edge instead of stretching it across the panel; the
       * kit's Small size is 24px tall with a 12px label, matching the text.
       */}
      <Button
        variant={ButtonVariant.Primary}
        appearance={ButtonAppearance.Link}
        size={ElementSize.Small}
        className="self-start"
        label={viewDetailsLabel}
        iconBefore={
          <IconEye
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        }
        onClick={onViewDetails}
        tabIndex={viewDetailsTabIndex}
      />
    </div>
  );
};
