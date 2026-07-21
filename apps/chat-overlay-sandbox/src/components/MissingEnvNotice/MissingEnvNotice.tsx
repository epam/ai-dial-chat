import { FC, memo } from 'react';
import { CHAT_OVERLAY_HOST_ENV_VAR } from '../../env';

const MissingEnvNotice: FC = () => (
  <div role="alert" style={{ padding: 16, border: '1px solid #c0392b' }}>
    <p>
      Missing required environment variable{' '}
      <code>{CHAT_OVERLAY_HOST_ENV_VAR}</code>.
    </p>
    <p>
      Set it in <code>apps/chat-overlay-sandbox/.env.development</code> to the
      URL of a running <code>apps/chat</code> instance with overlay mode
      enabled, then restart the dev server.
    </p>
  </div>
);

export default memo(MissingEnvNotice);
