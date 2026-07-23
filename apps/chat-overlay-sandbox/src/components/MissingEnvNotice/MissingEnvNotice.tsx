import { FC, memo } from 'react';
import {
  CHAT_OVERLAY_HOST_ENV_VAR,
  VITE_CHAT_OVERLAY_HOST_ENV_VAR,
} from '../../env';

const MissingEnvNotice: FC = () => (
  <div role="alert" style={{ padding: 16, border: '1px solid #c0392b' }}>
    <p>
      Missing required environment variable{' '}
      <code>{CHAT_OVERLAY_HOST_ENV_VAR}</code>.
    </p>
    <p>
      Set <code>{CHAT_OVERLAY_HOST_ENV_VAR}</code> in the deployed container, or{' '}
      <code>{VITE_CHAT_OVERLAY_HOST_ENV_VAR}</code> in{' '}
      <code>apps/chat-overlay-sandbox/.env.development</code> for local Vite
      runs.
    </p>
  </div>
);

export default memo(MissingEnvNotice);
