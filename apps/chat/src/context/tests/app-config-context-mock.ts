import type { ReactNode } from 'react';
import { vi } from 'vitest';

/*
 * Shared mock surface for `context/AppConfigContext`. A spec mocks the real
 * module with this one and configures the spies it needs:
 *
 *   vi.mock('<relative>/context/AppConfigContext', async () =>
 *     import('<relative>/context/tests/app-config-context-mock'),
 *   );
 *
 * The spies are module-level singletons, so importing `useAppConfig` from this
 * file and `vi.mocked(useAppConfig)` imported from the real (mocked) module are
 * the same function. Both hooks are always defined, so a component deeper in
 * the import graph calling a hook the spec never configured fails an assertion
 * instead of the whole file with "No X export is defined on the mock".
 *
 * `useFeatureFlag` defaults to `false` — the same value the real hook returns
 * for unknown flags and while the config is not ready. `useAppConfig` has no
 * default return value on purpose: a spec that renders something reading the
 * config must state the state it wants.
 */
export const useAppConfig = vi.fn();

export const useFeatureFlag = vi.fn((key?: string): boolean => false);

/* Renders children through, the way specs that mount the (mocked) provider
 * in their harness expect; specs that never render it are unaffected. */
const AppConfigProviderMock = vi.fn(
  ({ children }: { children?: ReactNode }) => children ?? null,
);

export default AppConfigProviderMock;
