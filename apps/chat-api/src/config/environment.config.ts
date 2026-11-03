import { IntersectionType } from '@nestjs/swagger';
import { AuthProvidersEnv } from './env/auth-providers.env';
import { AuthEnv } from './env/auth.env';
import { CelebrationsEnv } from './env/celebrations.env';
import { ClientUiEnv } from './env/client-ui.env';
import { DialEnv } from './env/dial.env';
import { FeatureFlagsEnv } from './env/feature-flags.env';
import { FilesEnv } from './env/files.env';
import { GenerationEnv } from './env/generation.env';
import { IntegrationsEnv } from './env/integrations.env';
import { ServerEnv } from './env/server.env';

export { IFRAME_ORIGIN_PATTERN } from './env/env-patterns';
export { ApplicationLogLevel } from './env/server.env';

/**
 * The validated chat-api environment. Each domain declares its own vars in
 * `config/env/<domain>.env.ts`; add a new var to the class it belongs to, not
 * here. `validation.ts` validates against this composed class, and services
 * inject `ConfigService<EnvironmentVariables>`.
 */
export class EnvironmentVariables extends IntersectionType(
  ServerEnv,
  DialEnv,
  AuthEnv,
  AuthProvidersEnv,
  FilesEnv,
  GenerationEnv,
  ClientUiEnv,
  CelebrationsEnv,
  FeatureFlagsEnv,
  IntegrationsEnv,
) {}
