import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../app-config.service';
import type { AppConfigEvalContext } from '../app-config.types';
import { CONFIG_DEFINITIONS } from '../config-registry/config-registry.constants';
import { FeatureKey } from './feature-key.enum';

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(private readonly appConfigService: AppConfigService) {}

  async isEnabled(
    key: FeatureKey,
    context: AppConfigEvalContext,
  ): Promise<boolean> {
    const definition = CONFIG_DEFINITIONS.find((d) => d.key === key);
    if (!definition || definition.type !== 'feature') {
      throw new BadRequestException(
        `Key "${key}" is not a valid feature flag key`,
      );
    }

    try {
      return await this.appConfigService.isEnabled(key, context);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.warn(
        `Feature flag resolution failed for key "${key}", returning false: ${String(err)}`,
      );
      return false;
    }
  }
}
