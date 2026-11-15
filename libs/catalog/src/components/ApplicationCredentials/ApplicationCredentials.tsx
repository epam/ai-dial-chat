import {
  CaptionText,
  DIAL_ICON_SIZE,
  ErrorText,
  LiveRegion,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import type { FC, ReactNode } from 'react';
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
  const loadErrorText = texts?.loadError ?? 'Unable to load credentials';
  const emptyText = texts?.empty ?? 'No credentials required';
  const isLoadingShown = isLoading && !services.length;
  const isErrorShown = !isLoadingShown && hasError;
  const isEmptyStateShown =
    !isLoadingShown && !hasError && !services.length && showEmptyState;

  let statusText = '';
  if (isErrorShown) statusText = loadErrorText;
  else if (isEmptyStateShown) statusText = emptyText;

  let content: ReactNode = null;
  if (isLoadingShown) {
    content = (
      <Spinner
        className="justify-start px-6 py-3"
        size={DIAL_ICON_SIZE.MD}
        ariaLabel={texts?.loading ?? 'Loading…'}
      />
    );
  } else if (isErrorShown) {
    content = (
      <div className="flex flex-col gap-2 px-6 py-3">
        <ErrorText aria-hidden text={loadErrorText} />
        <NeutralButton
          className="min-h-11 self-start"
          label={texts?.retry ?? 'Retry'}
          onClick={onRetry}
        />
      </div>
    );
  } else if (isEmptyStateShown) {
    content = (
      <CaptionText aria-hidden className="block px-6 py-3" text={emptyText} />
    );
  } else if (services.length) {
    content = (
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
  }

  return (
    <>
      {/* Mounted across every state so the load failure and the empty state are announced when they replace the spinner. */}
      <LiveRegion visuallyHidden>{statusText}</LiveRegion>
      {content}
    </>
  );
};
