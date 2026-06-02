import { IconInfoCircleFilled } from '@tabler/icons-react';
import { FC } from 'react';

/** Props for the model-change status message banner. */
export interface StatusMessageBubbleProps {
  /**
   * Bold prefix text displayed before the description.
   * @default "Model switched."
   */
  titleText?: string;
  /** Full description text, e.g. "The model has been switched from GPT to Imagen." */
  bodyText: string;
}

/**
 * Full-width info banner rendered in the conversation timeline when the active
 * deployment changes. Matches Figma node 613:8730 (`section-message`).
 * Does not render message actions, ratings, or a copy button.
 */
export const StatusMessageBubble: FC<StatusMessageBubbleProps> = ({
  titleText = 'Model switched.',
  bodyText,
}) => {
  return (
    <div className="flex w-full items-center gap-3 overflow-hidden rounded border border-[var(--stroke-info)] bg-[var(--bg-info)] p-3">
      <IconInfoCircleFilled
        size={20}
        className="shrink-0 text-[var(--text-primary)]"
      />
      <div className="flex min-w-0 flex-1 items-center gap-1 text-sm leading-5 text-[var(--text-primary)]">
        <span className="shrink-0 font-semibold">{titleText}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-normal">
          {bodyText}
        </span>
      </div>
    </div>
  );
};
