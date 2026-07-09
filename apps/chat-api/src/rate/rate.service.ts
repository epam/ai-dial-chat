import { Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import type { RateMessageDto } from './dto/rate-message.dto';

@Injectable()
export class RateService {
  private readonly logger = new Logger(RateService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async rateMessage(dto: RateMessageDto, accessToken: string): Promise<void> {
    const url = `${this.dialClient.baseUrl}/v1/${encodeURIComponent(dto.modelId)}/rate`;

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
      handleDialSdkError(error, 'rate.rateMessage', this.logger);
    }
  }
}
