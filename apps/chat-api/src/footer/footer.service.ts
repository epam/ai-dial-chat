import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment.config';
import type { ReportIssueDto } from './dto/report-issue.dto';
import type { RequestApiKeyDto } from './dto/request-api-key.dto';

@Injectable()
export class FooterService implements OnModuleInit {
  private readonly logger = new Logger(FooterService.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  onModuleInit(): void {
    const host = this.configService.get('AZURE_FUNCTIONS_API_HOST', {
      infer: true,
    });
    if (!host) {
      this.logger.warn(
        'AZURE_FUNCTIONS_API_HOST is not set — footer dialog submissions will return 503',
      );
    }
  }

  async requestApiKey(
    body: RequestApiKeyDto,
    requesterEmail: string,
  ): Promise<void> {
    const host = this.configService.get('AZURE_FUNCTIONS_API_HOST', {
      infer: true,
    });
    const code = this.configService.get('REQUEST_API_KEY_CODE', {
      infer: true,
    });

    if (!host || !code) {
      throw new ServiceUnavailableException(
        'Footer dialog is not configured: AZURE_FUNCTIONS_API_HOST and REQUEST_API_KEY_CODE must be set',
      );
    }

    const url = `${host}/api/request?code=${encodeURIComponent(code)}`;
    const payload = { ...body, requester_email: requesterEmail };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.error(`requestApiKey upstream fetch failed: ${String(err)}`);
      throw new BadGatewayException('Upstream Azure Function request failed');
    }

    if (!response.ok) {
      this.logger.error(
        `requestApiKey upstream returned status ${response.status}`,
      );
      throw new BadGatewayException(
        `Upstream Azure Function returned ${response.status}`,
      );
    }
  }

  async reportIssue(body: ReportIssueDto, email: string): Promise<void> {
    const host = this.configService.get('AZURE_FUNCTIONS_API_HOST', {
      infer: true,
    });
    const code = this.configService.get('REPORT_ISSUE_CODE', { infer: true });

    if (!host || !code) {
      throw new ServiceUnavailableException(
        'Footer dialog is not configured: AZURE_FUNCTIONS_API_HOST and REPORT_ISSUE_CODE must be set',
      );
    }

    const url = `${host}/api/issue?code=${encodeURIComponent(code)}`;
    const payload = { ...body, email };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.error(`reportIssue upstream fetch failed: ${String(err)}`);
      throw new BadGatewayException('Upstream Azure Function request failed');
    }

    if (!response.ok) {
      this.logger.error(
        `reportIssue upstream returned status ${response.status}`,
      );
      throw new BadGatewayException(
        `Upstream Azure Function returned ${response.status}`,
      );
    }
  }
}
