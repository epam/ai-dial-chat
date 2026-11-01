import { PrimaryButton, StateScreen } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';

/** Props for `FullScreenAlert`. */
export interface FullScreenAlertProps {
  /** Decorative icon drawn in the badge above the heading; mark it `aria-hidden`. */
  icon: ReactNode;
  /** Screen heading, rendered as the `h1` that names the section. */
  heading: string;
  /** Explanation under the heading. */
  message: string;
  /** Text of the single action button. */
  actionLabel: string;
  /** Called when the action button is activated. */
  onAction: () => void;
}

/*
 * The screen replaces the whole view, so it is page state rather than a live
 * update: it carries no live-region role (one that mounts with its text is
 * announced unreliably anyway). The auto-focused action moves focus into the
 * `section` named by the heading, which is what gets announced.
 */
/** Full-screen state that replaces the whole app with an icon, heading, message and one focused action. */
export const FullScreenAlert: FC<FullScreenAlertProps> = memo(
  ({ icon, heading, message, actionLabel, onAction }) => (
    <div className="size-full">
      <StateScreen
        icon={icon}
        title={heading}
        description={message}
        action={
          <PrimaryButton autoFocus label={actionLabel} onClick={onAction} />
        }
      />
    </div>
  ),
);
