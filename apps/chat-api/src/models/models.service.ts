import type { DialModel, DialModelListResponse } from '@epam/chat-shared';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import type { EnvironmentVariables } from '../config/environment.config';

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);
  private readonly dialCoreUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.dialCoreUrl = this.configService.get('DIAL_CORE_URL', {
      infer: true,
    }) as string;
    this.timeout =
      this.configService.get('DIAL_CORE_TIMEOUT_MS', {
        infer: true,
      }) ?? 10000;
  }

  async listModels(
    userSub: string,
    accessToken: string,
  ): Promise<DialModelListResponse> {
    const cacheKey = `models:list:${userSub}`;
    const cached = await this.cacheManager.get<DialModelListResponse>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for models list (sub: ${userSub})`);
      return cached;
    }

    const url = `${this.dialCoreUrl}/openai/models`;
    this.logger.debug(`Fetching models list from ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.mapUpstreamError(response.status, 'list models');
      }

      const data = (await response.json()) as DialModelListResponse;
      await this.cacheManager.set(cacheKey, data, 30 * 1000);
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      this.handleCaughtError(err, 'list models');
    }
  }

  async getModel(
    userSub: string,
    accessToken: string,
    modelName: string,
  ): Promise<DialModel> {
    const cacheKey = `models:single:${userSub}:${modelName}`;
    const cached = await this.cacheManager.get<DialModel>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for model "${modelName}" (sub: ${userSub})`);
      return cached;
    }

    const url = `${this.dialCoreUrl}/openai/models/${modelName}`;
    this.logger.debug(`Fetching model "${modelName}" from ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.mapUpstreamError(response.status, `get model "${modelName}"`);
      }

      const data = (await response.json()) as DialModel;
      await this.cacheManager.set(cacheKey, data, 60 * 1000);
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      this.handleCaughtError(err, `get model "${modelName}"`);
    }
  }

  private mapUpstreamError(status: number, context: string): never {
    this.logger.warn(`DIAL Core returned ${status} for ${context}`);
    if (status === 401) throw new UnauthorizedException();
    if (status === 403) throw new ForbiddenException();
    if (status === 404) throw new NotFoundException('Model not found');
    if (status === 429) throw new HttpException('Too Many Requests', 429);
    if (status >= 500)
      throw new BadGatewayException('DIAL Core returned a server error');
    throw new BadGatewayException(`Unexpected upstream status ${status}`);
  }

  private handleCaughtError(err: unknown, context: string): never {
    if (
      err instanceof UnauthorizedException ||
      err instanceof ForbiddenException ||
      err instanceof NotFoundException ||
      err instanceof HttpException ||
      err instanceof BadGatewayException ||
      err instanceof ServiceUnavailableException
    ) {
      throw err;
    }

    const error = err as { name?: string; message?: string; stack?: string };

    if (error.name === 'AbortError') {
      this.logger.error(
        `DIAL Core request timed out after ${this.timeout}ms (${context})`,
      );
      throw new ServiceUnavailableException('DIAL Core request timed out');
    }

    this.logger.error(
      `Unexpected error during ${context}: ${error.message}`,
      error.stack,
    );
    throw new ServiceUnavailableException('DIAL Core is currently unavailable');
  }
}
