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
    <div className="flex w-full items-center gap-[var(--spacing-03,12px)] overflow-hidden rounded-[var(--radius-1,4px)] border border-[var(--stroke\/info)] bg-[var(--background\/info)] p-[var(--spacing-03,12px)]">
      <IconInfoCircleFilled
        size={20}
        className="shrink-0 text-[color:var(--text\&icon\/primary)]"
      />
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-01,4px)] text-sm leading-5 text-[color:var(--text\&icon\/primary)]">
        <span className="shrink-0 font-semibold">{titleText}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-normal">
          {bodyText}
        </span>
      </div>
    </div>
  );
};
