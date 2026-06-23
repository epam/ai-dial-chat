import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionUser } from '../../auth/session/session.types';
import type { AppConfigEvalContext } from '../app-config.types';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureKey } from './feature-key.enum';
import { FEATURE_KEY_METADATA } from './require-feature.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<FeatureKey | undefined>(
      FEATURE_KEY_METADATA,
      executionContext.getHandler(),
    );

    if (!featureKey) {
      return true;
    }

    const request = executionContext.switchToHttp().getRequest<Request>();
    const sessionUser = request.user as SessionUser | undefined;
    const context: AppConfigEvalContext = {
      appId: 'chat-ui',
      userId: sessionUser?.sub,
      roles: extractRoles(sessionUser?.claims),
    };
    const isEnabled = await this.featureFlagsService.isEnabled(
      featureKey,
      context,
    );

    if (!isEnabled) {
      throw new ForbiddenException(`Feature "${featureKey}" is not enabled`);
    }

    return true;
  }
}

function extractRoles(
  claims: Record<string, unknown> | undefined,
): string[] | undefined {
  const roles = claims?.['roles'];
  return Array.isArray(roles)
    ? roles.filter((role): role is string => typeof role === 'string')
    : undefined;
}
