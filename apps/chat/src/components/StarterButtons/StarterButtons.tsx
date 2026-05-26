import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';

interface Props {
  /** Starter options to display as buttons. */
  starters: StarterOption[];
  /**
   * Called when a button is clicked.
   * @param text - The text to populate in the input field.
   * @param submit - When `true` the message should be sent immediately;
   *   when `false` only the input field should be populated.
   * @param confirmationMessage - When non-null a confirmation dialog should be
   *   shown with this text before the action is executed.
   * @param configurationValue - When set, should be sent as
   *   `custom_content.configuration_value` on the message (e.g. `{ button: 1 }`).
   */
  onSelect: (
    text: string,
    submit: boolean,
    confirmationMessage: string | null,
    configurationValue?: Record<string, unknown>,
  ) => void;
  /**
   * The deployment schema property key that these starters belong to
   * (e.g. `"button"`). When provided, each click passes
   * `{ [propertyKey]: starter.const }` as `configurationValue`.
   */
  propertyKey?: string;
}

const StarterButtons: FC<Props> = ({ starters, onSelect, propertyKey }) => {
  if (starters.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Conversation starters"
      className="mt-4 flex flex-wrap justify-center gap-2"
    >
      {starters.map((starter) => (
        <div key={starter.const} role="listitem">
          <DialRoundedButton
            label={starter.title}
            onClick={() =>
              onSelect(
                starter['dial:widgetOptions'].populateText || starter.title,
                starter['dial:widgetOptions'].submit,
                starter['dial:widgetOptions'].confirmationMessage,
                propertyKey ? { [propertyKey]: starter.const } : undefined,
              )
            }
          />
        </div>
      ))}
    </div>
  );
};

export default StarterButtons;
