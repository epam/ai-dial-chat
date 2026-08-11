import { Controller, ForbiddenException, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SandboxService } from './sandbox.service';

@Controller()
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Get()
  serveSandbox(@Req() req: Request, @Res() res: Response): void {
    const referer = req.headers.referer;
    const origin = req.headers.origin;
    const validatedOrigin = this.sandboxService.validateRefererOrigin(
      referer,
      origin,
    );
    if (validatedOrigin == null) {
      throw new ForbiddenException(
        'Referer header missing or its origin is not allowlisted',
      );
    }

    const { html, cspHeader } =
      this.sandboxService.buildResponse(validatedOrigin);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Security-Policy', cspHeader);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'no-store');
    res.send(html);
  }
}
