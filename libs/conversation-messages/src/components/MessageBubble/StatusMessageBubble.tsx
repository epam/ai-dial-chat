import { DialNotification } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';

/** User-visible strings for {@link StatusMessageBubble}. */
export interface StatusMessageBubbleLabels {
  /** Bold prefix text displayed before the description. Defaults to `'Model switched.'`. */
  titleText?: string;
  /** Full description text, e.g. "The model has been switched from GPT to Imagen." */
  bodyText: string;
}

/** Props for the model-change status message banner. */
export interface StatusMessageBubbleProps {
  /** User-visible strings. */
  labels: StatusMessageBubbleLabels;
}

/**
 * Full-width info banner rendered in the conversation timeline when the active
 * deployment changes. Matches Figma node 613:8730 (`section-message`).
 * Does not render message actions, ratings, or a copy button.
 */
export const StatusMessageBubble: FC<StatusMessageBubbleProps> = ({
  labels: { titleText = 'Model switched.', bodyText },
}) => {
  return (
    <div role="status" aria-live="polite">
      <DialNotification
        title={titleText}
        message={bodyText}
        textClassName="flex-row flex-wrap gap-1"
      />
    </div>
  );
};
