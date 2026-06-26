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

const CONFIG_PATH = '.client_data/.user-config.json';
const LEGACY_CONFIG_PATH = '.user-config.json';
const LEGACY_TOOLSETS_PATH = 'clientdata/installed_toolsets.json';
const LEGACY_DEPLOYMENTS_PATH = 'clientdata/installed_deployments.json';

@Injectable()
export class UserConfigService extends AppService {
  protected override logger = new Logger(UserConfigService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
  }

  async readConfig(token: string, bucket: string): Promise<UserConfig> {
    try {
      let config = await this.readConfigFromPath(CONFIG_PATH, token, bucket);

      if (config == null) {
        const legacyConfig = await this.readConfigFromPath(
          LEGACY_CONFIG_PATH,
          token,
          bucket,
        );
        if (legacyConfig != null) {
          config = legacyConfig;
          await this.writeConfig(config, token, bucket);
          await this.deleteFileBestEffort(LEGACY_CONFIG_PATH, token, bucket);
        } else {
          config = {
            ...DEFAULT_USER_CONFIG,
            conversations: { pinnedIds: [] },
            toolsets: { installed: [] },
            deployments: { installed: [], selectedId: null },
          };
        }
      }

      const { config: merged, changed } =
        await this.consolidateLegacyInstallationFiles(config!, token, bucket);

      if (changed) {
        await this.writeConfig(merged, token, bucket);
      }

      return merged;
    } catch {
      this.logger.warn('Failed to read user config, using default');
      return {
        ...DEFAULT_USER_CONFIG,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [], selectedId: null },
      };
    }
  }

  private async readConfigFromPath(
    path: string,
    token: string,
    bucket: string,
  ): Promise<UserConfig | null> {
    try {
      const { response } = (await this.client.downloadFile(bucket, path, {
        headers: getBearerAuthHeaders(token),
        parseAs: 'stream',
      })) as { response: Response };

      if (!response.ok) return null;

      const text = await response.text();
      return migrateConfig(JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }

  private async deleteFileBestEffort(
    path: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    try {
      await this.client.deleteFile(bucket, path, {
        headers: getBearerAuthHeaders(token),
      });
    } catch (err) {
      this.logger.warn(`Failed to delete legacy config file at ${path}`, err);
    }
  }

  private mergeInstalledIds(base: string[], legacy: string[]): string[] {
    const set = new Set(base);
    const additions = legacy.filter((id) => !set.has(id));
    return additions.length > 0 ? [...base, ...additions] : base;
  }

  private async consolidateLegacyInstallationFiles(
    config: UserConfig,
    token: string,
    bucket: string,
  ): Promise<{ config: UserConfig; changed: boolean }> {
    let changed = false;
    let current = config;

    for (const [path, section] of [
      [LEGACY_TOOLSETS_PATH, 'toolsets'],
      [LEGACY_DEPLOYMENTS_PATH, 'deployments'],
    ] as const) {
      try {
        const { response } = (await this.client.downloadFile(bucket, path, {
          headers: getBearerAuthHeaders(token),
          parseAs: 'stream',
        })) as { response: Response };

        if (!response.ok) continue;

        const text = await response.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          this.logger.warn(
            `Malformed legacy installation file at ${path}, skipping`,
          );
          continue;
        }

        if (!Array.isArray(parsed)) {
          this.logger.warn(
            `Legacy installation file at ${path} is not an array, skipping`,
          );
          continue;
        }

        const legacyIds = (parsed as unknown[])
          .map((entry) => {
            if (typeof entry === 'string') return entry;
            if (
              entry != null &&
              typeof entry === 'object' &&
              'id' in entry &&
              typeof (entry as Record<string, unknown>)['id'] === 'string'
            ) {
              return (entry as Record<string, unknown>)['id'] as string;
            }
            return null;
          })
          .filter((id): id is string => id != null);

        const merged = this.mergeInstalledIds(
          current[section].installed,
          legacyIds,
        );

        if (merged !== current[section].installed) {
          current = {
            ...current,
            [section]: { ...current[section], installed: merged },
          };
          changed = true;
        }
      } catch {
        // non-ok download is handled above; unexpected errors are ignored
      }
    }

    return { config: current, changed };
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

      if (error != null) {
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

  async getInstalledIds(
    token: string,
    bucket: string,
  ): Promise<{ toolsets: string[]; deployments: string[] }> {
    const config = await this.readConfig(token, bucket);
    return {
      toolsets: config.toolsets.installed,
      deployments: config.deployments.installed,
    };
  }

  async getPinnedIds(token: string, bucket: string): Promise<string[]> {
    const config = await this.readConfig(token, bucket);
    return config.conversations.pinnedIds;
  }

  async updatePin(
    conversationId: string,
    isPinned: boolean,
    token: string,
    bucket: string,
  ): Promise<void> {
    const config = await this.readConfig(token, bucket);
    const ids = config.conversations.pinnedIds;

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

  /**
   * If `oldId` is currently pinned, replace it with `newId` in a single
   * read-modify-write. No-ops silently when `oldId` is not pinned.
   */
  async migratePin(
    oldId: string,
    newId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const config = await this.readConfig(token, bucket);
    const ids = config.conversations.pinnedIds;
    const index = ids.indexOf(oldId);
    if (index === -1) return;
    ids[index] = newId;
    await this.writeConfig(
      { ...config, version: CURRENT_CONFIG_VERSION },
      token,
      bucket,
    );
  }

  private async updateInstalledEntry(
    section: 'toolsets' | 'deployments',
    id: string,
    isInstalled: boolean,
    token: string,
    bucket: string,
  ): Promise<void> {
    const config = await this.readConfig(token, bucket);
    const ids = config[section].installed;

    if (isInstalled) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      const index = ids.indexOf(id);
      if (index !== -1) ids.splice(index, 1);
    }

    await this.writeConfig(
      { ...config, version: CURRENT_CONFIG_VERSION },
      token,
      bucket,
    );
  }

  async updateInstalledToolset(
    id: string,
    isInstalled: boolean,
    token: string,
    bucket: string,
  ): Promise<void> {
    return this.updateInstalledEntry(
      'toolsets',
      id,
      isInstalled,
      token,
      bucket,
    );
  }

  async updateInstalledDeployment(
    id: string,
    isInstalled: boolean,
    token: string,
    bucket: string,
  ): Promise<void> {
    return this.updateInstalledEntry(
      'deployments',
      id,
      isInstalled,
      token,
      bucket,
    );
  }

  async updateSelectedDeployment(
    id: string | null,
    token: string,
    bucket: string,
  ): Promise<void> {
    const config = await this.readConfig(token, bucket);
    await this.writeConfig(
      {
        ...config,
        version: CURRENT_CONFIG_VERSION,
        deployments: { ...config.deployments, selectedId: id },
      },
      token,
      bucket,
    );
  }
}
