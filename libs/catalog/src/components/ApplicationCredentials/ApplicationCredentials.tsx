import { NeutralButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { ApplicationCredentialsProps } from '../../models/application-credentials';
import { ApplicationCredentialRow } from './ApplicationCredentialRow/ApplicationCredentialRow';

/** Application credentials forms using the same row and status components as toolsets. */
export const ApplicationCredentials: FC<ApplicationCredentialsProps> = ({
  services,
  isLoading = false,
  hasError = false,
  showEmptyState = false,
  onRetry,
  onLogin,
  onLogout,
  texts,
}) => {
  if (isLoading && !services.length) {
    return (
      <p role="status" className="px-6 py-3">
        {texts?.loading ?? 'Loading…'}
      </p>
    );
  }
  if (hasError) {
    return (
      <div className="flex flex-col gap-2 px-6 py-3">
        <p role="alert">{texts?.loadError ?? 'Unable to load credentials'}</p>
        <NeutralButton
          className="min-h-11 self-start"
          label={texts?.retry ?? 'Retry'}
          onClick={onRetry}
        />
      </div>
    );
  }
  if (!services.length) {
    return showEmptyState ? (
      <p role="status" className="px-6 py-3">
        {texts?.empty ?? 'No credentials required'}
      </p>
    ) : null;
  }
  return (
    <section
      aria-label={texts?.title ?? 'Credentials'}
      className="flex min-w-0 flex-col gap-5 px-6 py-4"
    >
      <h2 className="dial-h3-text">{texts?.title ?? 'Credentials'}</h2>
      <div className="flex min-w-0 flex-col">
        {services.map((service) => (
          <ApplicationCredentialRow
            key={service.id}
            service={service}
            texts={texts}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        ))}
      </div>
    </section>
  );
};
