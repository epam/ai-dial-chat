import { FC, memo } from 'react';
import { VITE_CHAT_OVERLAY_HOST_ENV_VAR } from '../../env';

const MissingEnvNotice: FC = () => (
  <div role="alert" style={{ padding: 16, border: '1px solid #c0392b' }}>
    <p>Unable to resolve the chat overlay host.</p>
    <p>
      Deployed builds use the current origin. For local Vite runs, set{' '}
      <code>{VITE_CHAT_OVERLAY_HOST_ENV_VAR}</code> in{' '}
      <code>apps/chat-overlay-sandbox/.env.development</code>.
    </p>
  </div>
);

export default memo(MissingEnvNotice);
