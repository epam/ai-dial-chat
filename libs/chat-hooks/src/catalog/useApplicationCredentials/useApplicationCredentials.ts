import type {
  ApplicationExternalServiceDto,
  ExternalServicesApi,
  OfflineCredentialsApi,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Configured operations for loading application credential metadata. */
export interface UseApplicationCredentialsParams {
  /** Application identifier passed through to the configured client. */
  appId: string;
  /** Host-configured external-services API. */
  externalServicesClient: Pick<ExternalServicesApi, 'listExternalServices'>;
  /** Host-configured offline-credentials API. */
  offlineCredentialsClient: Pick<
    OfflineCredentialsApi,
    'getOfflineCredentials'
  >;
}

/** Loads fresh service statuses without coupling proactive credentials to a live completion. */
export const useApplicationCredentials = ({
  appId,
  externalServicesClient,
  offlineCredentialsClient,
}: UseApplicationCredentialsParams) => {
  const [services, setServices] = useState<ApplicationExternalServiceDto[]>([]);
  const [isOfflineConnected, setIsOfflineConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const generation = useRef(0);
  const activeAppId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (activeAppId.current !== appId) return;
    const request = ++generation.current;
    setIsLoading(true);
    setHasError(false);
    try {
      const data = await externalServicesClient.listExternalServices({ appId });
      if (generation.current !== request) return;
      const hasDialNative = data.some(
        (service) => service.authenticationType === 'DIAL_NATIVE',
      );
      const offline = hasDialNative
        ? await offlineCredentialsClient.getOfflineCredentials()
        : undefined;
      if (generation.current !== request) return;
      setServices(
        data.filter((service) => service.authenticationType !== 'NONE'),
      );
      setIsOfflineConnected(offline?.connected ?? false);
    } catch {
      if (generation.current === request) setHasError(true);
    } finally {
      if (generation.current === request) setIsLoading(false);
    }
  }, [appId, externalServicesClient, offlineCredentialsClient]);

  const invalidate = useCallback(() => {
    activeAppId.current = null;
    generation.current++;
  }, []);

  useEffect(() => {
    activeAppId.current = appId;
    setServices([]);
    setIsLoading(true);
    setIsOfflineConnected(false);
    refresh();
    return invalidate;
  }, [appId, refresh, invalidate]);

  return { services, isOfflineConnected, isLoading, hasError, refresh };
};
