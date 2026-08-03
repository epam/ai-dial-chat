import { FC, memo } from 'react';
import { VITE_CHAT_OVERLAY_HOST_ENV_VAR } from '../../env';

const MissingEnvNotice: FC = () => (
  <div className="border border-error bg-error p-4" role="alert">
    <p>Unable to resolve the chat overlay host.</p>
    <p>
      Deployed builds use the current origin. For local Vite runs, set{' '}
      <code>{VITE_CHAT_OVERLAY_HOST_ENV_VAR}</code> in{' '}
      <code>apps/chat-overlay-sandbox/.env.development</code>.
    </p>
  </div>
);

export default memo(MissingEnvNotice);
