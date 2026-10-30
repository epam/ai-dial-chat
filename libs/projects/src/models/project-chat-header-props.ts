import type { MouseEvent } from 'react';

/** Props for the {@link ProjectChatHeader} component. */
export interface ProjectChatHeaderProps {
  /** Name of the project the chat belongs to. */
  projectName: string;
  /** URL of the project's page, used by the project name link. */
  projectHref: string;
  /** Called from the back button. */
  onBack: () => void;
  /** Called when the project name link is activated; call `event.preventDefault()` to route in-app. */
  onProjectLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Accessible name of the header and the back button, e.g. "Back to Q4 launch". */
  backLabel: string;
  /** CSS class applied to the header bar, e.g. its border color. */
  className?: string;
  /** CSS class applied to the project name. Defaults to `'dial-body-text'`. */
  nameClassName?: string;
}
