import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';

const DEFAULT_SKILL_TRANSFER_TIMEOUT_MS = 60_000;

/** Reads `SKILL_TRANSFER_TIMEOUT_MS`, shared by every skills sub-service's SDK calls. */
export const getSkillTransferTimeoutMs = (
  configService: ConfigService<EnvironmentVariables>,
): number =>
  configService.get<number>('SKILL_TRANSFER_TIMEOUT_MS') ??
  DEFAULT_SKILL_TRANSFER_TIMEOUT_MS;
