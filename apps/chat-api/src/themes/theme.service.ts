import { createHash } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
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
  private readonly REMOTE_CACHE_PREFIX = 'themes:remote:';
  private readonly REMOTE_ICON_CACHE_PREFIX = 'themes:remote:icon:';
  /** Origins a per-application theme URL may be fetched from. Empty disables remote themes. */
  private readonly allowedOrigins: Set<string>;
  /** Cap on a remote `config.json`, refused before parsing. */
  private readonly MAX_REMOTE_CONFIG_BYTES = 256 * 1024;
  /** Cap on a remote icon, refused before buffering. */
  private readonly MAX_REMOTE_ICON_BYTES = 2 * 1024 * 1024;
  /** A colour key is written straight into a CSS custom property name. */
  private readonly COLOR_KEY_PATTERN = /^[a-zA-Z0-9-]+$/;

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
    this.allowedOrigins = this.parseAllowedOrigins(
      this.configService.get('THEMES_ALLOWED_ORIGINS', { infer: true }),
    );
  }

  /**
   * Parses `THEMES_ALLOWED_ORIGINS` into the set of origins a remote theme may
   * be fetched from.
   *
   * A malformed or non-`https` entry is dropped with a warning rather than
   * throwing: one bad entry in an operator's comma-separated list must not
   * stop the application from booting.
   */
  private parseAllowedOrigins(raw: string | undefined): Set<string> {
    const origins = new Set<string>();
    if (!raw) return origins;

    for (const entry of raw.split(',')) {
      const candidate = entry.trim();
      if (!candidate) continue;

      let parsed: URL;
      try {
        parsed = new URL(candidate);
      } catch {
        this.logger.warn(
          `Ignoring unparseable THEMES_ALLOWED_ORIGINS entry: ${candidate}`,
        );
        continue;
      }

      if (parsed.protocol !== 'https:') {
        this.logger.warn(
          `Ignoring non-https THEMES_ALLOWED_ORIGINS entry: ${candidate}`,
        );
        continue;
      }

      origins.add(parsed.origin);
    }

    return origins;
  }

  /**
   * Resolves an application-supplied theme URL to the upstream base this
   * service may request, or throws before any socket is opened.
   *
   * Membership is exact origin equality, never a suffix match: allow-listing
   * `https://themes.example.com` must not admit
   * `https://themes.example.com.attacker.test`. The rejection message names
   * neither the resolved address nor any upstream detail, so a caller cannot
   * use this endpoint to probe what the server can reach.
   */
  private resolveAllowedOrigin(themeUrl: string): {
    origin: string;
    pathname: string;
  } {
    let parsed: URL;
    try {
      parsed = new URL(themeUrl);
    } catch {
      throw new BadRequestException('themeUrl is not a valid URL');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('themeUrl must use https');
    }

    if (!this.allowedOrigins.has(parsed.origin)) {
      throw new BadRequestException('themeUrl origin is not allowed');
    }

    /*
     * The supplied query and fragment are discarded: the upstream request is
     * always `<origin><pathname>/config.json`, so a caller cannot steer it by
     * appending to the URL. A trailing slash is trimmed so a host given with
     * and without one shares a cache entry.
     */
    return {
      origin: parsed.origin,
      pathname: parsed.pathname.replace(/\/+$/, ''),
    };
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

  /**
   * Fetches a theme configuration from an allow-listed external themes host on
   * behalf of an application that declares its own theme URL.
   *
   * @throws {BadRequestException} The URL is malformed, not https, or its origin is not allow-listed — thrown before any request is made.
   * @throws {NotFoundException} The host has no `config.json` there.
   * @throws {BadGatewayException} The host redirected, errored, or returned an oversized or malformed body.
   * @throws {ServiceUnavailableException} The request timed out or the host was unreachable.
   */
  async getRemoteTheme(themeUrl: string): Promise<ThemeConfigResponseDto> {
    const { origin, pathname } = this.resolveAllowedOrigin(themeUrl);
    const cacheKey = `${this.REMOTE_CACHE_PREFIX}${this.hashTarget(origin, pathname)}`;

    const cached =
      await this.cacheManager.get<ThemeConfigResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached remote theme for ${origin}`);
      return cached;
    }

    const response = await this.fetchRemote(
      `${origin}${pathname}/config.json`,
      origin,
    );

    const body = await this.readCapped(
      response,
      this.MAX_REMOTE_CONFIG_BYTES,
      origin,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch {
      this.logger.error(`Remote theme at ${origin} is not valid JSON`);
      throw new BadGatewayException('Remote theme configuration is malformed');
    }

    const config = this.sanitizeRemoteConfig(parsed, origin);
    await this.cacheManager.set(cacheKey, config);
    return config;
  }

  /**
   * Fetches one image from an allow-listed external themes host.
   *
   * `iconName` is validated by the controller's DTO against the same
   * path-traversal allowlist the built-in icon endpoint uses.
   */
  async getRemoteThemeIcon(
    themeUrl: string,
    iconName: string,
  ): Promise<string | Buffer> {
    const { origin, pathname } = this.resolveAllowedOrigin(themeUrl);
    const cacheKey = `${this.REMOTE_ICON_CACHE_PREFIX}${this.hashTarget(origin, pathname)}:${iconName}`;

    const cached = await this.cacheManager.get<string | Buffer>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached remote icon: ${iconName}`);
      return cached;
    }

    const response = await this.fetchRemote(
      `${origin}${pathname}/${iconName}`,
      origin,
      iconName,
    );

    const buffer = await this.readCapped(
      response,
      this.MAX_REMOTE_ICON_BYTES,
      origin,
    );
    const content = iconName.includes('.svg')
      ? buffer.toString('utf8')
      : buffer;

    await this.cacheManager.set(cacheKey, content);
    return content;
  }

  /**
   * Hashes the upstream target into a cache key.
   *
   * An arbitrary-length URL with arbitrary characters has no business being a
   * cache key verbatim; the pathname is included so two applications pointing
   * at different directories on one host do not collide.
   */
  private hashTarget(origin: string, pathname: string): string {
    return createHash('sha256').update(`${origin}${pathname}`).digest('hex');
  }

  /**
   * Performs the upstream request shared by both remote endpoints.
   *
   * Redirects are not followed: an allow-listed origin answering `302` to an
   * internal address would otherwise turn the allowlist into a stepping stone.
   */
  private async fetchRemote(
    url: string,
    origin: string,
    iconName?: string,
  ): Promise<Response> {
    const subject = iconName ? `icon '${iconName}' at ${origin}` : origin;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400) {
        this.logger.error(
          `Remote theme host redirected for ${subject}; refusing to follow`,
        );
        throw new BadGatewayException('Remote theme host returned a redirect');
      }

      if (!response.ok) {
        this.logger.error(
          `Failed to fetch remote theme ${subject}: ${response.status} ${response.statusText}`,
        );
        if (response.status === 404) {
          throw new NotFoundException('Remote theme resource not found');
        }
        throw new BadGatewayException('Remote theme host returned an error');
      }

      return response;
    } catch (er) {
      const error = er as { name?: string; message?: string; stack?: string };

      if (error.name === 'AbortError') {
        this.logger.error(
          `Remote theme request for ${subject} timed out after ${this.timeout}ms`,
        );
        throw new ServiceUnavailableException('Remote theme request timed out');
      }

      if (
        er instanceof NotFoundException ||
        er instanceof BadGatewayException ||
        er instanceof ServiceUnavailableException
      ) {
        throw er;
      }

      this.logger.error(
        `Unexpected error fetching remote theme ${subject}: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException('Remote theme host is unavailable');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Buffers a response body, refusing anything over `limit`.
   *
   * `Content-Length` is only a hint — a host may omit or understate it — so the
   * running total is checked as chunks arrive rather than trusting the header.
   */
  private async readCapped(
    response: Response,
    limit: number,
    origin: string,
  ): Promise<Buffer> {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > limit) {
      this.logger.error(
        `Remote theme response from ${origin} declares ${declared} bytes, over the ${limit} limit`,
      );
      throw new BadGatewayException('Remote theme response is too large');
    }

    const body = response.body;
    if (!body) return Buffer.alloc(0);

    const chunks: Buffer[] = [];
    let total = 0;

    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        this.logger.error(
          `Remote theme response from ${origin} exceeded the ${limit} byte limit`,
        );
        throw new BadGatewayException('Remote theme response is too large');
      }
      chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Validates a remote configuration and strips colour keys that are not safe
   * to write as CSS custom property names.
   *
   * A key containing `;` or `}` is inert in every current browser once it
   * reaches `style.setProperty`, but this payload comes from a third party the
   * operator only allow-listed by origin, so the question is removed rather
   * than left to the browser.
   */
  private sanitizeRemoteConfig(
    parsed: unknown,
    origin: string,
  ): ThemeConfigResponseDto {
    const config = parsed as Partial<ThemeConfigResponseDto>;
    const themes = config?.themes;

    if (!Array.isArray(themes) || themes.length === 0) {
      this.logger.error(`Remote theme at ${origin} declares no themes`);
      throw new BadGatewayException('Remote theme configuration is malformed');
    }

    const sanitized = themes.map((theme) => {
      if (!theme || typeof theme.id !== 'string' || theme.id.trim() === '') {
        this.logger.error(
          `Remote theme at ${origin} has a theme without an id`,
        );
        throw new BadGatewayException(
          'Remote theme configuration is malformed',
        );
      }

      const colors: Record<string, string> = {};
      for (const [key, value] of Object.entries(theme.colors ?? {})) {
        if (typeof value !== 'string') continue;
        if (!this.COLOR_KEY_PATTERN.test(key)) {
          this.logger.warn(
            `Dropping unsafe colour key '${key}' from remote theme at ${origin}`,
          );
          continue;
        }
        colors[key] = value;
      }

      return { ...theme, colors };
    });

    return { ...config, themes: sanitized } as ThemeConfigResponseDto;
  }
}
