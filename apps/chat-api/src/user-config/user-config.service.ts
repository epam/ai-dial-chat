import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import { EnvironmentVariables } from '../config/environment.config';
import {
  CURRENT_CONFIG_VERSION,
  DEFAULT_USER_CONFIG,
  UserConfig,
  migrateConfig,
} from './dto/user-config.dto';

const CONFIG_PATH = '.user-config.json';

@Injectable()
export class UserConfigService extends AppService {
  protected override logger = new Logger(UserConfigService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
  }

  async readConfig(token: string, bucket: string): Promise<UserConfig> {
    try {
      const { response } = (await this.client.downloadFile(
        bucket,
        CONFIG_PATH,
        {
          headers: getBearerAuthHeaders(token),
          parseAs: 'stream',
        },
      )) as { response: Response };

      if (!response.ok) return { ...DEFAULT_USER_CONFIG };

      const text = await response.text();
      return migrateConfig(JSON.parse(text) as unknown);
    } catch {
      console.warn('Failed to read user config, using default', {
        token,
        bucket,
      });
      return { ...DEFAULT_USER_CONFIG };
    }
  }

  async writeConfig(
    config: UserConfig,
    token: string,
    bucket: string,
  ): Promise<void> {
    try {
      const { error, response } = (await this.client.uploadFile(
        bucket,
        CONFIG_PATH,
        {
          headers: getBearerAuthHeaders(token),
          // FormData ensures fetch emits Content-Type: multipart/form-data;boundary=…
          // A plain Buffer causes openapi-fetch to send a boundary-less header, which DIAL Core rejects.
          body: (() => {
            const fd = new FormData();
            fd.append('file', new Blob([JSON.stringify(config)]), CONFIG_PATH);
            return fd;
          })() as unknown as string,
        },
      )) as { error?: unknown; response: Response };

      if (error !== undefined) {
        const body = await response.text().catch(() => '(unreadable)');
        this.logger.error(
          `Failed to write user config — DIAL Core ${response.status}: ${body}`,
          error,
        );
        return handleDialError({ status: response.status });
      }
    } catch (err) {
      this.logger.error('Failed to write user config', err);
      throw err;
    }
  }

  async getPinnedIds(token: string, bucket: string): Promise<string[]> {
    const config = await this.readConfig(token, bucket);
    return config.pinnedConversationIds;
  }

  async updatePin(
    conversationId: string,
    isPinned: boolean,
    token: string,
    bucket: string,
  ): Promise<void> {
    const config = await this.readConfig(token, bucket);
    const ids = config.pinnedConversationIds;

    if (isPinned) {
      if (!ids.includes(conversationId)) ids.push(conversationId);
    } else {
      const index = ids.indexOf(conversationId);
      if (index !== -1) ids.splice(index, 1);
    }

    await this.writeConfig(
      { ...config, version: CURRENT_CONFIG_VERSION },
      token,
      bucket,
    );
  }
}
