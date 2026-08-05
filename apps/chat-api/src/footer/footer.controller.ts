import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ReportIssueDto } from './dto/report-issue.dto';
import { RequestApiKeyDto } from './dto/request-api-key.dto';
import { FooterService } from './footer.service';

@ApiTags('footer')
@Controller({ path: 'footer', version: '1' })
export class FooterController {
  constructor(private readonly footerService: FooterService) {}

  @Post('request-api-key')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    operationId: 'requestApiKey',
    summary: 'Submit a Request API Key form',
    description:
      'Proxies the form submission to the configured Azure Function. ' +
      'The requester email is injected server-side from the authenticated session.',
  })
  @ApiResponse({ status: 200, description: 'Request submitted successfully.' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required.',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  @ApiResponse({
    status: 503,
    description:
      'Azure Functions env vars not configured; submissions are unavailable.',
  })
  @ApiResponse({
    status: 502,
    description: 'Upstream Azure Function returned an error.',
  })
  async requestApiKey(
    @Req() req: Request,
    @Body() body: RequestApiKeyDto,
  ): Promise<Record<string, never>> {
    const user = req.user as SessionUser;
    const email = (user.claims['email'] as string | undefined) ?? user.sub;
    await this.footerService.requestApiKey(body, email);
    return {};
  }

  @Post('report-issue')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'reportIssue',
    summary: 'Submit a Report an Issue form',
    description:
      'Proxies the form submission to the configured Azure Function. ' +
      'The reporter email is injected server-side from the authenticated session.',
  })
  @ApiResponse({ status: 200, description: 'Issue reported successfully.' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required.',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  @ApiResponse({
    status: 503,
    description:
      'Azure Functions env vars not configured; submissions are unavailable.',
  })
  @ApiResponse({
    status: 502,
    description: 'Upstream Azure Function returned an error.',
  })
  async reportIssue(
    @Req() req: Request,
    @Body() body: ReportIssueDto,
  ): Promise<Record<string, never>> {
    const user = req.user as SessionUser;
    const email = (user.claims['email'] as string | undefined) ?? user.sub;
    await this.footerService.reportIssue(body, email);
    return {};
  }
}
