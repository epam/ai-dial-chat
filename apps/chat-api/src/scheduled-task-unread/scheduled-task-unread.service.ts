import { Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import {
  DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS,
  parseViewedScheduledTaskConversations,
  ViewedScheduledTaskConversations,
} from './dto/viewed-scheduled-task-conversations.dto';

const VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH =
  '.client_data/.viewed-scheduled-task-conversations.json';

@Injectable()
export class ScheduledTaskUnreadService {
  private readonly logger = new Logger(ScheduledTaskUnreadService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async getViewedIds(token: string, bucket: string): Promise<string[]> {
    const config = await this.readConfig(token, bucket);
    return config.conversationIds;
  }

  async markViewed(
    conversationId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const config = await this.readConfig(token, bucket);

    if (config.conversationIds.includes(conversationId)) {
      await this.writeConfig(config, token, bucket);
      return;
    }

    await this.writeConfig(
      {
        ...config,
        conversationIds: [...config.conversationIds, conversationId],
      },
      token,
      bucket,
    );
  }

  private async readConfig(
    token: string,
    bucket: string,
  ): Promise<ViewedScheduledTaskConversations> {
    try {
      const { response } = (await this.dialClient.client.downloadFile(
        bucket,
        VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH,
        {
          headers: getBearerAuthHeaders(token),
          parseAs: 'stream',
        },
      )) as { response: Response };

      if (!response.ok) {
        return { ...DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS };
      }

      const text = await response.text();
      return parseViewedScheduledTaskConversations(JSON.parse(text));
    } catch {
      this.logger.warn(
        'Failed to read viewed scheduled-task conversations, using default',
      );
      return { ...DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS };
    }
  }

  private async writeConfig(
    config: ViewedScheduledTaskConversations,
    token: string,
    bucket: string,
  ): Promise<void> {
    try {
      const { error, response } = (await this.dialClient.client.uploadFile(
        bucket,
        VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH,
        {
          headers: getBearerAuthHeaders(token),
          /*
           * FormData ensures fetch emits Content-Type: multipart/form-data;boundary=…
           * A plain Buffer causes openapi-fetch to send a boundary-less header, which DIAL Core rejects.
           */
          body: (() => {
            const fd = new FormData();
            fd.append(
              'file',
              new Blob([JSON.stringify(config)]),
              VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH,
            );
            return fd;
          })() as unknown as string,
        },
      )) as { error?: unknown; response: Response };

      if (error != null) {
        const body = await response.text().catch(() => '(unreadable)');
        this.logger.error(
          `Failed to write viewed scheduled-task conversations — DIAL Core ${response.status}: ${body}`,
          error,
        );
        return handleDialSdkError(
          error,
          'scheduled-task-unread.writeConfig',
          this.logger,
          response,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to write viewed scheduled-task conversations',
        err,
      );
      throw err;
    }
  }
}
