import {
  ErrorMessageNotification,
  NotificationType,
} from '@epam/ai-dial-ui-kit';
import { FC, memo } from 'react';
import { VITE_CHAT_OVERLAY_HOST_ENV_VAR } from '../../env';

/*
 * Static page content that replaces a case's body, not an update: the kit's
 * error default (`role="alert"`) is overridden with `status`.
 */
const MissingEnvNotice: FC = () => (
  <ErrorMessageNotification
    role="status"
    type={NotificationType.SectionMessage}
    title="Unable to resolve the chat overlay host."
    message={
      <>
        Deployed builds use the current origin. For local Vite runs, set{' '}
        <code>{VITE_CHAT_OVERLAY_HOST_ENV_VAR}</code> in{' '}
        <code>apps/chat-overlay-sandbox/.env.development</code>.
      </>
    }
  />
);

export default memo(MissingEnvNotice);
