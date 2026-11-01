import {
  CaptionText,
  DIAL_ICON_SIZE,
  ErrorText,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
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
  typography,
}) => {
  if (isLoading && !services.length) {
    return (
      <Spinner
        className="justify-start px-6 py-3"
        size={DIAL_ICON_SIZE.MD}
        ariaLabel={texts?.loading ?? 'Loading…'}
      />
    );
  }
  if (hasError) {
    return (
      <div className="flex flex-col gap-2 px-6 py-3">
        <ErrorText
          role="status"
          text={texts?.loadError ?? 'Unable to load credentials'}
        />
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
      <CaptionText
        role="status"
        className="block px-6 py-3"
        text={texts?.empty ?? 'No credentials required'}
      />
    ) : null;
  }
  return (
    <section
      aria-label={texts?.title ?? 'Credentials'}
      className="flex min-w-0 flex-col gap-5 px-6 py-4"
    >
      <h2 className={typography?.titleClassName ?? 'dial-h3-text'}>
        {texts?.title ?? 'Credentials'}
      </h2>
      <div className="flex min-w-0 flex-col">
        {services.map((service) => (
          <ApplicationCredentialRow
            key={service.id}
            service={service}
            texts={texts}
            onLogin={onLogin}
            onLogout={onLogout}
            typography={typography}
          />
        ))}
      </div>
    </section>
  );
};
