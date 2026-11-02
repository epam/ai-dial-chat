import { Injectable, Logger } from '@nestjs/common';
import { DialClientService } from '../dial/dial-client.service';
import {
  ClientDataJsonFile,
  ClientDataReadKind,
} from './client-data-json-file';
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

  private readonly file: ClientDataJsonFile;

  constructor(private readonly dialClient: DialClientService) {
    this.file = new ClientDataJsonFile(
      this.dialClient,
      this.logger,
      'viewed scheduled-task conversations',
      'scheduled-task-unread',
    );
  }

  async getViewedIds(token: string, bucket: string): Promise<string[]> {
    try {
      const config = await this.readConfig(token, bucket);
      return config.conversationIds;
    } catch {
      /* A read-only lookup degrades to "nothing viewed" rather than failing the page. */
      this.logger.warn(
        'Failed to read viewed scheduled-task conversations, using default',
      );
      return [];
    }
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

  /** @throws HttpException when DIAL Core fails the read (anything but a 404). */
  private async readConfig(
    token: string,
    bucket: string,
  ): Promise<ViewedScheduledTaskConversations> {
    const result = await this.file.read(
      VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH,
      token,
      bucket,
    );
    return result.kind === ClientDataReadKind.Ok
      ? parseViewedScheduledTaskConversations(result.value)
      : { ...DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS };
  }

  private writeConfig(
    config: ViewedScheduledTaskConversations,
    token: string,
    bucket: string,
  ): Promise<void> {
    return this.file.write(
      VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH,
      config,
      token,
      bucket,
    );
  }
}
