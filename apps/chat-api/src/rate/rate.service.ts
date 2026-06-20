import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import type { EnvironmentVariables } from '../config/environment.config';
import type { RateMessageDto } from './dto/rate-message.dto';

@Injectable()
export class RateService extends AppService {
  protected override logger = new Logger(RateService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
  }

  async rateMessage(dto: RateMessageDto, accessToken: string): Promise<void> {
    const url = `${this.baseUrl}/v1/${encodeURIComponent(dto.modelId)}/rate`;

    this.logger.debug(
      `Rating message: responseId=${dto.responseId}, rate=${dto.rate}, modelId=${dto.modelId}`,
    );

    try {
      const body: Record<string, unknown> = {
        rate: dto.rate,
        modelId: dto.modelId,
        conversationId: dto.conversationId,
        responseId: dto.responseId,
      };
      if (dto.comment != null) {
        body['comment'] = dto.comment;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerAuthHeaders(accessToken),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw Object.assign(new Error('DIAL Core rate error'), {
          status: response.status,
        });
      }
    } catch (error) {
      handleDialError(error);
    }
  }
}
