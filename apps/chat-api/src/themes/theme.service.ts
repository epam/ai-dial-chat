import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { EnvironmentVariables } from '../config/environment.config';
import { ThemeConfigResponseDto } from '../openapi/openapi-response.dto';

/**
 * Service for fetching theme configuration and icons from an external theme service.
 *
 * @remarks
 * The service connects to an external themes service specified by the THEMES_CONFIG_URL
 * environment variable. All requests have a configurable timeout (THEMES_SERVICE_TIMEOUT_MS)
 * to prevent hanging on unresponsive services. Theme configuration and icons are cached
 * to reduce load on the external service.
 *
 * @example
 * ```typescript
 * const themes = await themeService.getThemes();
 * const iconSvg = await themeService.getThemeIcon('icon-light.svg');
 * ```
 */
@Injectable()
export class ThemeService {
  private readonly logger = new Logger(ThemeService.name);
  private readonly themesUrl: string | undefined;
  private readonly timeout: number | undefined;
  private readonly THEMES_CACHE_KEY = 'themes:config';
  private readonly ICON_CACHE_PREFIX = 'themes:icon:';

  /**
   * Creates an instance of ThemeService.
   *
   * @param configService - NestJS ConfigService for accessing validated environment variables
   * @param cacheManager - Cache manager for storing theme data
   *
   * @remarks
   * Requires the following environment variables to be set:
   * - THEMES_CONFIG_URL: Base URL of the themes service
   * - THEMES_SERVICE_TIMEOUT_MS (optional): Request timeout in milliseconds (default: 5000)
   */
  constructor(
    private configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.themesUrl = this.configService.get('THEMES_CONFIG_URL', {
      infer: true,
    });
    this.timeout = this.configService.get('THEMES_SERVICE_TIMEOUT_MS', {
      infer: true,
    });
  }

  /**
   * Fetches the theme configuration from the external themes service.
   * Results are cached for 5 minutes to reduce load on the external service.
   *
   * @returns A promise that resolves to the theme configuration object
   *
   * @throws {NotFoundException} When the configuration file is not found (HTTP 404)
   * @throws {BadGatewayException} When the external service returns an error response (HTTP 5xx)
   * @throws {ServiceUnavailableException} When the request times out or the service is unreachable
   *
   * @example
   * ```typescript
   * try {
   *   const config = await themeService.getThemes();
   * } catch (error) {
   *   if (error instanceof NotFoundException) {
   *     console.error('Theme configuration not found');
   *   }
   * }
   * ```
   */
  async getThemes(): Promise<ThemeConfigResponseDto> {
    const cached = await this.cacheManager.get<ThemeConfigResponseDto>(
      this.THEMES_CACHE_KEY,
    );
    if (cached) {
      this.logger.debug('Returning cached theme configuration');
      return cached;
    }

    this.logger.debug(
      `Fetching themes configuration from ${this.themesUrl}/config.json`,
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.themesUrl}/config.json`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch themes: ${response.status} ${response.statusText}`,
        );
        if (response.status === 404) {
          throw new NotFoundException('Theme configuration not found');
        }
        throw new BadGatewayException(
          `Failed to fetch theme configuration: ${response.statusText}`,
        );
      }

      const data = await response.json();
      this.logger.debug('Successfully fetched themes configuration');

      // Cache the result
      await this.cacheManager.set(this.THEMES_CACHE_KEY, data);

      return data as ThemeConfigResponseDto;
    } catch (er) {
      const error = er as { name: string; message: string; stack?: string };
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        this.logger.error(
          `Theme service request timed out after ${this.timeout}ms`,
        );
        throw new ServiceUnavailableException(
          'Theme service request timed out',
        );
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error(
        `Unexpected error fetching themes: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Theme service is currently unavailable',
      );
    }
  }

  /**
   * Fetches a theme icon SVG file from the external themes service.
   * Results are cached for 5 minutes to reduce load on the external service.
   *
   * @param iconName - The filename of the icon to fetch (e.g., 'icon-light.svg')
   * @returns A promise that resolves to the SVG content as a string
   *
   * @throws {NotFoundException} When the icon file is not found (HTTP 404)
   * @throws {BadGatewayException} When the external service returns an error response (HTTP 5xx)
   * @throws {ServiceUnavailableException} When the request times out or the service is unreachable
   *
   * @remarks
   * The icon name is validated by the controller to prevent path traversal attacks.
   * Only alphanumeric characters, dashes, underscores, and dots are allowed.
   *
   * @example
   * ```typescript
   * try {
   *   const svgContent = await themeService.getThemeIcon('icon-dark.svg');
   *   // svgContent contains the raw SVG markup
   * } catch (error) {
   *   if (error instanceof NotFoundException) {
   *     console.error('Icon not found');
   *   }
   * }
   * ```
   */
  async getThemeIcon(iconName: string): Promise<string | Buffer<ArrayBuffer>> {
    const cacheKey = `${this.ICON_CACHE_PREFIX}${iconName}`;

    // Check cache first
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached icon: ${iconName}`);
      return cached;
    }

    this.logger.debug(`Fetching theme icon: ${iconName}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const imageUrl = `${this.themesUrl}/${iconName}`;
      const response = await fetch(imageUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch icon '${iconName}': ${response.status} ${response.statusText}`,
        );
        if (response.status === 404) {
          throw new NotFoundException(`Theme icon '${iconName}' not found`);
        }
        throw new BadGatewayException(
          `Failed to fetch theme icon: ${response.statusText}`,
        );
      }

      const resContent = iconName.includes('.svg')
        ? await response.text()
        : Buffer.from(await response.arrayBuffer());

      this.logger.debug(`Successfully fetched theme icon: ${iconName}`);

      // Cache the result
      await this.cacheManager.set(cacheKey, resContent);

      return resContent;
    } catch (er) {
      const error = er as { name: string; message: string; stack?: string };
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        this.logger.error(
          `Theme icon request for '${iconName}' timed out after ${this.timeout}ms`,
        );
        throw new ServiceUnavailableException(
          'Theme service request timed out',
        );
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error(
        `Unexpected error fetching icon '${iconName}': ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Theme service is currently unavailable',
      );
    }
  }
}
