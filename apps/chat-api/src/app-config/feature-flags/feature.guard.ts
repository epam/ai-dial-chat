import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionUser } from '../../auth/session/session.types';
import { UserRolesService } from '../../auth/user-roles.service';
import type { AppConfigEvalContext } from '../app-config.types';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureKey } from './feature-key.enum';
import { FEATURE_KEY_METADATA } from './require-feature.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly userRoles: UserRolesService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    /* A handler-level @RequireFeature overrides one set on the controller class. */
    const featureKey = this.reflector.getAllAndOverride<
      FeatureKey | FeatureKey[] | undefined
    >(FEATURE_KEY_METADATA, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    if (!featureKey) {
      return true;
    }

    const request = executionContext.switchToHttp().getRequest<Request>();
    const sessionUser = request.user as SessionUser | undefined;
    const context: AppConfigEvalContext = {
      appId: 'chat-ui',
      userId: sessionUser?.sub,
      roles: sessionUser ? this.userRoles.getRoles(sessionUser) : undefined,
    };
    const featureKeys = Array.isArray(featureKey) ? featureKey : [featureKey];
    for (const key of featureKeys) {
      if (await this.featureFlagsService.isEnabled(key, context)) {
        return true;
      }
    }
    throw new ForbiddenException(
      `Feature "${featureKeys.join('" or "')}" is not enabled`,
    );
  }
}
