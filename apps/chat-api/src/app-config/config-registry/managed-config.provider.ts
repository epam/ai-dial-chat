import { Injectable } from '@nestjs/common';
import type { ConfigProvider } from '../app-config.types';

/**
 * Placeholder for a future managed-config integration (e.g. dial-admin config store).
 *
 * Expected runtime-toggle contract:
 *   - Poll or subscribe to an external config store on a configurable interval.
 *   - Return `undefined` for any key not managed by the external store so the next
 *     provider in the composite chain can supply a fallback.
 *   - No boot-time requirement — the store being unavailable at startup must not
 *     prevent the application from starting; errors must be caught and logged.
 *
 * To activate: provide a real implementation and register it in AppConfigModule
 * between EnvConfigProvider and StaticDefaultsProvider.
 */
@Injectable()
export class ManagedConfigProvider implements ConfigProvider {
  resolve(): Promise<unknown | undefined> {
    throw new Error(
      'ManagedConfigProvider is not yet configured — provide an implementation before registering it',
    );
  }
}
