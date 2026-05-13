import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from './session.service';
import type { SessionUser } from './session.types';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly session: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    let payload;
    try {
      payload = await this.session.decryptFromRequest(req);
    } catch {
      throw new UnauthorizedException();
    }

    const user: SessionUser = {
      sid: payload.sid,
      sub: payload.sub,
      providerId: payload.providerId,
      claims: payload.claims,
      at: payload.at,
    };
    req.user = user;
    return true;
  }
}
